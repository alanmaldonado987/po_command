alter table public.item
  add column prioridad text check (prioridad in ('Urgente', 'Alta', 'Normal', 'Baja'));

drop view public.v_bloqueante_abierto;
drop view public.v_item;

create view public.v_item with (security_invoker = true) as
with base as (
  select i.*,
         coalesce(i.plan_pruebas_fin, i.plan_fin) as fecha_compromiso,
         coalesce(i.real_pruebas_fin, i.real_fin) as fecha_entrega
  from public.item i
  where i.eliminado_en is null
),
calculado as (
  select b.*,
         case
           when b.fecha_compromiso is null then 0
           when b.estado = 'Terminado' then greatest(coalesce(b.fecha_entrega, b.fecha_compromiso) - b.fecha_compromiso, 0)
           when b.estado = 'Suspendido' then 0
           else greatest(public.hoy() - b.fecha_compromiso, 0)
         end as atraso_dias
  from base b
)
select c.*,
       case
         when lower(c.funcionalidad) = 'completo' then coalesce(m.nombre, '') || ' · completo'
         else c.funcionalidad
       end as titulo,
       c.estado not in ('Terminado', 'Suspendido') and c.atraso_dias > 0 as atrasado,
       pr.nombre as producto,
       cl.nombre as cliente,
       ac.nombre as actividad,
       m.nombre as modulo,
       pe.nombre as responsable,
       pe.correo as responsable_correo,
       pe.tablero_id as tablero_id,
       tb.nombre as tablero
from calculado c
left join public.producto pr on pr.id = c.producto_id
left join public.cliente cl on cl.id = c.cliente_id
left join public.actividad ac on ac.id = c.actividad_id
left join public.modulo m on m.id = c.modulo_id
left join public.persona pe on pe.id = c.responsable_id
left join public.clickup_tablero tb on tb.id = pe.tablero_id;

create view public.v_bloqueante_abierto with (security_invoker = true) as
select b.id, b.item_id, b.motivo, b.severidad, b.abierto_en, b.escalado_en,
       i.codigo, i.titulo, i.cliente_id, i.cliente, i.actividad, i.modulo, i.responsable, i.fecha_compromiso
from public.bloqueante b
join public.v_item i on i.id = b.item_id
where b.resuelto_en is null;

create or replace function public._prioridad_desde_clickup(p_prioridad jsonb) returns text
language sql immutable as $$
  select case lower(coalesce(
           case when jsonb_typeof(p_prioridad) = 'object' then coalesce(p_prioridad ->> 'priority', p_prioridad ->> 'id')
                else p_prioridad #>> '{}' end, ''))
           when 'urgent' then 'Urgente' when '1' then 'Urgente'
           when 'high' then 'Alta' when '2' then 'Alta'
           when 'normal' then 'Normal' when '3' then 'Normal'
           when 'low' then 'Baja' when '4' then 'Baja'
         end
$$;

create or replace function public.guardar_item(
  p_data jsonb,
  p_id bigint default null,
  p_nota text default '',
  p_tipo_nota text default 'Seguimiento',
  p_autor text default ''
) returns jsonb
language plpgsql as $$
declare
  v_datos jsonb := p_data - 'id' - 'creado_en' - 'actualizado_en' - 'eliminado_en' - 'terminado_en';
  v_antes public.item;
  v_nuevo public.item;
  v_abierto public.bloqueante;
  v_cambios jsonb := '[]'::jsonb;
  v_texto_cambios text := '';
  v_campo text;
  v_valor_antes text;
  v_valor_nuevo text;
  v_atraso integer;
  v_resumen_antes jsonb;
begin
  if p_id is not null then
    select * into v_antes from public.item where id = p_id and eliminado_en is null for update;
    if not found then
      raise exception 'El ítem % no existe', p_id;
    end if;
    v_nuevo := jsonb_populate_record(v_antes, v_datos - 'codigo');
    v_resumen_antes := jsonb_build_object('bloqueado', v_antes.bloqueado, 'motivo_bloqueo', v_antes.motivo_bloqueo);
  else
    v_nuevo := jsonb_populate_record(null::public.item, v_datos);
  end if;

  if v_datos ? 'producto' then
    v_nuevo.producto_id := public._catalogo_id('producto', v_datos ->> 'producto');
  end if;
  if v_datos ? 'cliente' then
    v_nuevo.cliente_id := public._catalogo_id('cliente', v_datos ->> 'cliente');
  end if;
  if v_datos ? 'actividad' then
    v_nuevo.actividad_id := public._catalogo_id('actividad', v_datos ->> 'actividad');
  end if;
  if v_datos ? 'modulo' then
    v_nuevo.modulo_id := public._catalogo_id('modulo', v_datos ->> 'modulo', v_nuevo.producto_id);
  end if;

  v_nuevo.funcionalidad := public._limpiar(v_nuevo.funcionalidad);
  if v_nuevo.funcionalidad = '' then
    raise exception 'La funcionalidad es obligatoria';
  end if;
  v_nuevo.descripcion := coalesce(v_nuevo.descripcion, '');
  v_nuevo.fase := coalesce(v_nuevo.fase, '');
  v_nuevo.alcance := coalesce(v_nuevo.alcance, '');
  v_nuevo.estado := coalesce(v_nuevo.estado, 'No iniciado');
  v_nuevo.prioridad := nullif(btrim(coalesce(v_nuevo.prioridad, '')), '');
  if v_nuevo.prioridad is not null and v_nuevo.prioridad not in ('Urgente', 'Alta', 'Normal', 'Baja') then
    raise exception 'La prioridad debe ser Urgente, Alta, Normal o Baja';
  end if;
  v_nuevo.bloqueado := coalesce(v_nuevo.bloqueado, false);
  v_nuevo.motivo_bloqueo := case
    when not v_nuevo.bloqueado then ''
    when public._limpiar(v_nuevo.motivo_bloqueo) = '' then 'Motivo pendiente: complétalo en el backlog'
    else btrim(v_nuevo.motivo_bloqueo)
  end;

  if v_nuevo.estado = 'Terminado' then
    v_nuevo.terminado_en := case
      when v_antes.estado = 'Terminado' and v_antes.terminado_en is not null then v_antes.terminado_en
      else coalesce(v_nuevo.real_pruebas_fin, v_nuevo.real_fin, public.hoy())
    end;
  else
    v_nuevo.terminado_en := null;
  end if;

  if p_id is not null then
    if (to_jsonb(v_antes) - 'actualizado_en') = (to_jsonb(v_nuevo) - 'actualizado_en') and public._limpiar(p_nota) = '' then
      return jsonb_build_object('id', v_antes.id, 'codigo', v_antes.codigo, 'antes', v_resumen_antes,
                                'cambios', v_cambios, 'sin_cambios', true);
    end if;

    foreach v_campo in array array['plan_ini', 'plan_fin', 'plan_pruebas_ini', 'plan_pruebas_fin'] loop
      v_valor_antes := to_jsonb(v_antes) ->> v_campo;
      v_valor_nuevo := to_jsonb(v_nuevo) ->> v_campo;
      if v_valor_antes is distinct from v_valor_nuevo then
        v_cambios := v_cambios || jsonb_build_object('campo', v_campo, 'antes', v_valor_antes, 'despues', v_valor_nuevo);
        v_texto_cambios := v_texto_cambios || case when v_texto_cambios = '' then '' else '; ' end
          || public._etiqueta_fecha(v_campo) || ': ' || public._formato_fecha(v_valor_antes)
          || ' → ' || public._formato_fecha(v_valor_nuevo);
      end if;
    end loop;

    update public.item set
      producto_id = v_nuevo.producto_id, cliente_id = v_nuevo.cliente_id, actividad_id = v_nuevo.actividad_id,
      modulo_id = v_nuevo.modulo_id, funcionalidad = v_nuevo.funcionalidad, descripcion = v_nuevo.descripcion,
      fase = v_nuevo.fase, alcance = v_nuevo.alcance, responsable_id = v_nuevo.responsable_id,
      plan_ini = v_nuevo.plan_ini, plan_fin = v_nuevo.plan_fin,
      plan_pruebas_ini = v_nuevo.plan_pruebas_ini, plan_pruebas_fin = v_nuevo.plan_pruebas_fin,
      real_ini = v_nuevo.real_ini, real_fin = v_nuevo.real_fin,
      real_pruebas_ini = v_nuevo.real_pruebas_ini, real_pruebas_fin = v_nuevo.real_pruebas_fin,
      estado = v_nuevo.estado, bloqueado = v_nuevo.bloqueado, motivo_bloqueo = v_nuevo.motivo_bloqueo,
      terminado_en = v_nuevo.terminado_en, clave_importacion = v_nuevo.clave_importacion,
      prioridad = v_nuevo.prioridad
    where id = p_id;
  else
    v_nuevo.id := nextval(pg_get_serial_sequence('public.item', 'id'));
    v_nuevo.codigo := coalesce(nullif(btrim(v_nuevo.codigo), ''), public.siguiente_codigo());
    v_nuevo.creado_en := now();
    v_nuevo.actualizado_en := now();
    v_nuevo.eliminado_en := null;
    insert into public.item select (v_nuevo).*;
  end if;

  if v_texto_cambios <> '' then
    insert into public.nota (item_id, tipo, texto, autor)
    values (v_nuevo.id, 'Reprogramación', 'Cambio de fechas · ' || v_texto_cambios, 'Automática');
  end if;
  if public._limpiar(p_nota) <> '' then
    insert into public.nota (item_id, tipo, texto, autor) values (v_nuevo.id, p_tipo_nota, btrim(p_nota), p_autor);
  end if;

  select * into v_abierto from public.bloqueante where item_id = v_nuevo.id and resuelto_en is null;
  if v_nuevo.bloqueado and v_abierto.id is null then
    select atraso_dias into v_atraso from public.v_item where id = v_nuevo.id;
    insert into public.bloqueante (item_id, motivo, severidad)
    values (v_nuevo.id, v_nuevo.motivo_bloqueo, case when v_atraso > 0 then 'Alta' else 'Media' end);
    insert into public.nota (item_id, tipo, texto, autor)
    values (v_nuevo.id, 'Bloqueo', 'Bloqueado: ' || v_nuevo.motivo_bloqueo, 'Automática');
  elsif v_nuevo.bloqueado then
    update public.bloqueante set motivo = v_nuevo.motivo_bloqueo where id = v_abierto.id;
  elsif v_abierto.id is not null then
    update public.bloqueante set resuelto_en = now() where id = v_abierto.id;
    insert into public.nota (item_id, tipo, texto, autor)
    values (v_nuevo.id, 'Bloqueo', 'Bloqueo resuelto: ' || v_abierto.motivo, 'Automática');
    perform public.cancelar_alertas('item', v_nuevo.id, array['BLOQUEO_ESCALAR']);
  end if;

  return jsonb_build_object('id', v_nuevo.id, 'codigo', v_nuevo.codigo, 'antes', v_resumen_antes,
                            'cambios', v_cambios, 'sin_cambios', false);
end
$$;

drop trigger encolar_clickup_cambio on public.item;
create trigger encolar_clickup_cambio
  after update of producto_id, cliente_id, actividad_id, modulo_id, funcionalidad, descripcion, fase, alcance,
    responsable_id, plan_ini, plan_fin, plan_pruebas_ini, plan_pruebas_fin, real_ini, real_fin, real_pruebas_ini,
    real_pruebas_fin, estado, bloqueado, motivo_bloqueo, prioridad, eliminado_en
  on public.item
  for each row execute function public.encolar_clickup();

create or replace function public.aplicar_cambio_clickup(
  p_tarea jsonb,
  p_evento text default 'taskUpdated',
  p_cliente_id bigint default null
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
    if v_actualizado <= v_existente.actualizado_en or v_actualizado <= coalesce(v_existente.clickup_sync_en, '-infinity'::timestamptz) then
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

revoke execute on function public.aplicar_cambio_clickup(jsonb, text, bigint) from public, anon, authenticated;
revoke execute on function public._prioridad_desde_clickup(jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_cambio_clickup(jsonb, text, bigint) to service_role;
grant execute on function public._prioridad_desde_clickup(jsonb) to service_role;
