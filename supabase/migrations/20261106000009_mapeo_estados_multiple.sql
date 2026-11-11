-- Mapeo de estados con varios nombres de ClickUp por estado de la app, comparación tolerante
-- (emojis, símbolos, tildes y mayúsculas), tipos 'closed' y 'done' como Terminado y
-- reconciliación forzada de los ítems ya importados.

create function public._normalizar_estado(p_texto text) returns text
language sql stable as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(p_texto, ''))), '[^a-z0-9]', '', 'g')
$$;

create function public._nombres_estado_clickup(p_valor jsonb) returns text[]
language sql immutable as $$
  select case jsonb_typeof(p_valor)
    when 'string' then array[p_valor #>> '{}']
    when 'array' then coalesce((select array_agg(nombre) from jsonb_array_elements_text(p_valor) nombre), array[]::text[])
    else array[]::text[]
  end
$$;

create function public._mapeo_estados_valido(p_mapeo jsonb) returns boolean
language sql immutable as $$
  select p_mapeo is null or (
    jsonb_typeof(p_mapeo) = 'object'
    and not exists (
      select 1
        from jsonb_each(p_mapeo) e
       where not (
         case jsonb_typeof(e.value)
           when 'string' then true
           when 'array' then not exists (select 1 from jsonb_array_elements(e.value) x where jsonb_typeof(x) <> 'string')
           else false
         end
       )
    )
  )
$$;

alter table public.clickup_config
  add constraint clickup_config_mapeo_estados_ck check (public._mapeo_estados_valido(mapeo_estados));
alter table public.clickup_tablero
  add constraint clickup_tablero_mapeo_estados_ck check (public._mapeo_estados_valido(mapeo_estados));

create or replace function public._estado_desde_clickup(p_mapeo jsonb, p_estado text, p_tipo text) returns text
language sql stable as $$
  select coalesce(
    (select e.key
       from jsonb_each(coalesce(p_mapeo, '{}'::jsonb)) e
      where public._normalizar_estado(p_estado) <> ''
        and exists (
          select 1
            from unnest(public._nombres_estado_clickup(e.value)) nombre
           where public._normalizar_estado(nombre) = public._normalizar_estado(p_estado)
        )
      order by array_position(array['No iniciado', 'En curso', 'Terminado, en etapa de pruebas', 'Terminado', 'Suspendido'], e.key)
      limit 1),
    case when p_tipo in ('closed', 'done') then 'Terminado' end
  )
$$;

drop function public.aplicar_cambio_clickup(jsonb, text, bigint);

create function public.aplicar_cambio_clickup(
  p_tarea jsonb,
  p_evento text default 'taskUpdated',
  p_cliente_id bigint default null,
  p_forzar boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_task_id text := p_tarea ->> 'id';
  v_lista_id text := p_tarea #>> '{list,id}';
  v_bloque jsonb := public._bloque_clickup(coalesce(p_tarea ->> 'markdown_description', p_tarea ->> 'description'));
  v_mapeo jsonb;
  v_existente public.item;
  v_destino public.clickup_destino;
  v_destino_final public.clickup_destino;
  v_actualizado timestamptz;
  v_titulo_actual text;
  v_nombre text;
  v_estado text;
  v_responsable bigint;
  v_hay_asignados boolean;
  v_bloqueado boolean;
  v_inicio date;
  v_fin date;
  v_alcance text;
  v_fase text;
  v_cliente_id bigint;
  v_cliente text;
  v_con_pruebas boolean;
  v_datos jsonb;
  v_resultado jsonb;
  v_item_id bigint;
  v_responsable_final bigint;
  v_cliente_final bigint;
  v_etiquetas jsonb := coalesce(p_tarea -> 'tags', '[]'::jsonb);
  v_prioridad text;
  v_prioridad_conocida boolean := false;
begin
  perform set_config('po.origen', 'clickup', true);
  if v_task_id is null then
    raise exception 'La tarea de ClickUp no trae id';
  end if;
  select * into v_existente from public.item where clickup_task_id = v_task_id;

  if p_evento = 'taskDeleted' or coalesce((p_tarea ->> 'archived')::boolean, false) then
    if v_existente.id is not null and v_existente.eliminado_en is null then
      perform public.eliminar_item(v_existente.id);
      perform set_config('po.origen', '', true);
      return jsonb_build_object('resultado', 'archivado', 'item_id', v_existente.id, 'codigo', v_existente.codigo);
    end if;
    perform set_config('po.origen', '', true);
    return jsonb_build_object('resultado', 'ignorado', 'motivo', 'sin ítem que archivar');
  end if;

  v_actualizado := to_timestamp(coalesce((p_tarea ->> 'date_updated')::numeric, extract(epoch from now()) * 1000) / 1000.0);
  select * into v_destino from public.clickup_destino
   where lista_id = v_lista_id
   order by (cliente_id is not null) desc, (tablero_id is not null) desc, id
   limit 1;
  v_mapeo := public.mapeo_estados_clickup(v_destino.tablero_id);

  if v_existente.id is null and v_destino.id is null and p_cliente_id is null then
    perform set_config('po.origen', '', true);
    return jsonb_build_object('resultado', 'ignorado', 'motivo', 'lista sin destino configurado');
  end if;

  if v_existente.id is not null then
    if v_existente.eliminado_en is not null then
      perform set_config('po.origen', '', true);
      return jsonb_build_object('resultado', 'ignorado', 'motivo', 'ítem eliminado en la app');
    end if;
    if not p_forzar and (v_actualizado <= v_existente.actualizado_en or v_actualizado <= coalesce(v_existente.clickup_sync_en, '-infinity'::timestamptz)) then
      perform set_config('po.origen', '', true);
      return jsonb_build_object('resultado', 'ignorado', 'motivo', 'el cambio de la app es más reciente');
    end if;
    if exists (select 1 from public.clickup_cola where item_id = v_existente.id and estado = 'Pendiente') then
      perform set_config('po.origen', '', true);
      return jsonb_build_object('resultado', 'ignorado', 'motivo', 'cambio de la app pendiente de envío');
    end if;
  end if;

  v_nombre := public._limpiar(p_tarea ->> 'name');
  v_estado := public._estado_desde_clickup(v_mapeo, p_tarea #>> '{status,status}', p_tarea #>> '{status,type}');
  v_inicio := public._ms_a_fecha(p_tarea ->> 'start_date');
  v_fin := public._ms_a_fecha(p_tarea ->> 'due_date');
  v_bloqueado := exists (select 1 from jsonb_array_elements(v_etiquetas) t where lower(t ->> 'name') = 'bloqueado');
  v_hay_asignados := jsonb_array_length(coalesce(p_tarea -> 'assignees', '[]'::jsonb)) > 0;
  v_alcance := public._etiqueta_canonica(v_etiquetas, array['Web', 'Mobile', 'Data', 'Automatización', 'APK']);
  v_fase := public._etiqueta_canonica(v_etiquetas, array['Desarrollo', 'Customización']);
  if p_tarea ? 'priority' then
    if jsonb_typeof(p_tarea -> 'priority') = 'null' then
      v_prioridad_conocida := true;
    else
      v_prioridad := public._prioridad_desde_clickup(p_tarea -> 'priority');
      v_prioridad_conocida := v_prioridad is not null;
    end if;
  end if;
  select p.id into v_responsable
    from public.persona p
   where p.activo and p.correo <> ''
     and lower(p.correo) in (
       select lower(a ->> 'email') from jsonb_array_elements(coalesce(p_tarea -> 'assignees', '[]'::jsonb)) a
     )
   order by p.id limit 1;

  if v_existente.id is null then
    v_cliente_id := coalesce(p_cliente_id, v_destino.cliente_id);
    select nombre into v_cliente from public.cliente where id = v_cliente_id;
    v_con_pruebas := (v_bloque ->> 'plan_pruebas_fin') is not null;
    v_datos := jsonb_strip_nulls(jsonb_build_object(
      'funcionalidad', case when v_nombre ilike '% · completo' then 'Completo' else v_nombre end,
      'modulo', coalesce(v_bloque ->> 'modulo', case when v_nombre ilike '% · completo' then regexp_replace(v_nombre, ' · completo$', '', 'i') end),
      'cliente', coalesce(v_cliente, v_bloque ->> 'cliente'),
      'actividad', v_bloque ->> 'actividad',
      'producto', coalesce(v_bloque ->> 'producto', 'FieldOps'),
      'fase', coalesce(v_fase, v_bloque ->> 'fase'),
      'alcance', coalesce(v_alcance, v_bloque ->> 'alcance'),
      'descripcion', coalesce(v_bloque ->> 'descripcion', left(p_tarea ->> 'text_content', 2000)),
      'estado', coalesce(v_estado, 'No iniciado'),
      'responsable_id', v_responsable,
      'bloqueado', v_bloqueado,
      'prioridad', v_prioridad,
      'motivo_bloqueo', case when v_bloqueado then coalesce(v_bloque ->> 'motivo', 'Bloqueado desde ClickUp') end,
      'plan_ini', v_inicio,
      'plan_fin', case when v_con_pruebas then v_bloque ->> 'plan_fin' else v_fin::text end,
      'plan_pruebas_ini', v_bloque ->> 'plan_pruebas_ini',
      'plan_pruebas_fin', case when v_con_pruebas then v_fin::text end,
      'real_ini', v_bloque ->> 'real_ini',
      'real_fin', v_bloque ->> 'real_fin',
      'real_pruebas_ini', v_bloque ->> 'real_pruebas_ini',
      'real_pruebas_fin', v_bloque ->> 'real_pruebas_fin'
    ));
  else
    select titulo into v_titulo_actual from public.v_item where id = v_existente.id;
    v_datos := jsonb_build_object(
      'plan_ini', v_inicio,
      'bloqueado', v_bloqueado,
      'motivo_bloqueo', case when v_bloqueado then coalesce(nullif(v_existente.motivo_bloqueo, ''), 'Bloqueado desde ClickUp') end
    );
    if v_existente.plan_pruebas_fin is not null then
      v_datos := v_datos || jsonb_build_object('plan_pruebas_fin', v_fin);
    else
      v_datos := v_datos || jsonb_build_object('plan_fin', v_fin);
    end if;
    if v_nombre <> '' and v_nombre <> v_titulo_actual and v_nombre <> v_existente.funcionalidad then
      v_datos := v_datos || jsonb_build_object('funcionalidad', v_nombre);
    end if;
    if v_estado is not null then
      v_datos := v_datos || jsonb_build_object('estado', v_estado);
    end if;
    if v_responsable is not null then
      v_datos := v_datos || jsonb_build_object('responsable_id', v_responsable);
    elsif not v_hay_asignados then
      v_datos := v_datos || jsonb_build_object('responsable_id', null);
    end if;
    if v_alcance is not null then
      v_datos := v_datos || jsonb_build_object('alcance', v_alcance);
    end if;
    if v_fase is not null then
      v_datos := v_datos || jsonb_build_object('fase', v_fase);
    end if;
    if v_prioridad_conocida then
      v_datos := v_datos || jsonb_build_object('prioridad', v_prioridad);
    end if;
  end if;

  v_resultado := public.guardar_item(v_datos, v_existente.id, '', 'Seguimiento', 'ClickUp');
  v_item_id := (v_resultado ->> 'id')::bigint;
  update public.item
     set clickup_task_id = v_task_id,
         clickup_url = coalesce(p_tarea ->> 'url', clickup_url),
         clickup_sync_en = v_actualizado,
         clickup_lista_id = coalesce(v_lista_id, clickup_lista_id)
   where id = v_item_id;

  select responsable_id, cliente_id into v_responsable_final, v_cliente_final from public.item where id = v_item_id;
  if v_responsable_final is not null and v_destino.id is not null then
    select * into v_destino_final from public.destino_clickup(
      (select tablero_id from public.persona where id = v_responsable_final), v_cliente_final);
    if v_destino_final.id is not null and v_destino_final.lista_id <> v_lista_id then
      perform public._encolar_clickup(v_item_id, 'mover');
    end if;
  end if;

  perform set_config('po.origen', '', true);
  return jsonb_build_object(
    'resultado', case when v_existente.id is null then 'creado' when (v_resultado ->> 'sin_cambios')::boolean then 'sin_cambios' else 'actualizado' end,
    'item_id', v_item_id,
    'codigo', v_resultado ->> 'codigo'
  );
end
$$;

revoke execute on function public.aplicar_cambio_clickup(jsonb, text, bigint, boolean) from public, anon, authenticated;
grant execute on function public.aplicar_cambio_clickup(jsonb, text, bigint, boolean) to service_role;
