create function public._limpiar(p_texto text) returns text
language sql immutable as $$
  select btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g'))
$$;

create function public._normalizar(p_texto text) returns text
language sql stable as $$
  select lower(extensions.unaccent(public._limpiar(p_texto)))
$$;

create function public.siguiente_codigo() returns text
language sql as $$
  select 'BL-' || lpad(nextval('public.item_codigo_seq')::text, 3, '0')
$$;

create function public._etiqueta_fecha(p_campo text) returns text
language sql immutable as $$
  select case p_campo
    when 'plan_ini' then 'inicio planificado'
    when 'plan_fin' then 'fin planificado'
    when 'plan_pruebas_ini' then 'inicio de pruebas planificado'
    when 'plan_pruebas_fin' then 'fin de pruebas planificado'
    else p_campo
  end
$$;

create function public._formato_fecha(p_fecha text) returns text
language sql immutable as $$
  select coalesce(to_char(p_fecha::date, 'DD/MM/YYYY'), '-')
$$;

create function public.registrar_auditoria(p_entidad text, p_entidad_id bigint, p_accion text, p_detalle text default '')
returns void
language sql security definer set search_path = '' as $$
  insert into public.auditoria (entidad, entidad_id, accion, detalle)
  values (p_entidad, p_entidad_id, p_accion, coalesce(p_detalle, ''))
$$;

create function public.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_accion text := case tg_op when 'INSERT' then 'crear' when 'DELETE' then 'eliminar' else 'editar' end;
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) ->> 'eliminado_en') is null and (v_fila ->> 'eliminado_en') is not null then
    v_accion := 'eliminar';
  end if;
  insert into public.auditoria (entidad, entidad_id, accion, detalle)
  values (
    tg_table_name,
    (v_fila ->> 'id')::bigint,
    v_accion,
    concat_ws(' ', v_fila ->> 'codigo', v_fila ->> 'nombre', v_fila ->> 'funcionalidad', v_fila ->> 'titulo')
  );
  return null;
end
$$;

create function public.tocar_actualizado() returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

create trigger auditar_item after insert or update or delete on public.item for each row execute function public.auditar();
create trigger auditar_persona after insert or update or delete on public.persona for each row execute function public.auditar();
create trigger auditar_ceremonia after insert or update or delete on public.ceremonia for each row execute function public.auditar();
create trigger auditar_producto after insert or update or delete on public.producto for each row execute function public.auditar();
create trigger auditar_cliente after insert or update or delete on public.cliente for each row execute function public.auditar();
create trigger auditar_actividad after insert or update or delete on public.actividad for each row execute function public.auditar();
create trigger auditar_modulo after insert or update or delete on public.modulo for each row execute function public.auditar();

create trigger tocar_item before update on public.item for each row execute function public.tocar_actualizado();
create trigger tocar_persona before update on public.persona for each row execute function public.tocar_actualizado();
create trigger tocar_producto before update on public.producto for each row execute function public.tocar_actualizado();

create function public._catalogo_id(p_tabla text, p_nombre text, p_producto_id bigint default null) returns bigint
language plpgsql as $$
declare
  v_nombre text := public._limpiar(p_nombre);
  v_id bigint;
begin
  if v_nombre = '' then
    return null;
  end if;
  if p_tabla not in ('producto', 'cliente', 'actividad', 'modulo') then
    raise exception 'Catálogo desconocido: %', p_tabla;
  end if;
  execute format('select id from public.%I where lower(nombre) = lower($1)', p_tabla) into v_id using v_nombre;
  if v_id is not null then
    return v_id;
  end if;
  if p_tabla = 'modulo' then
    insert into public.modulo (nombre, producto_id) values (v_nombre, p_producto_id) returning id into v_id;
  else
    execute format('insert into public.%I (nombre) values ($1) returning id', p_tabla) into v_id using v_nombre;
  end if;
  return v_id;
end
$$;

create function public.cancelar_alertas(p_entidad text, p_entidad_id bigint, p_reglas text[] default null) returns integer
language plpgsql as $$
declare
  v_cancelas integer;
begin
  with cancelas as (
    update public.alerta_programada
       set estado = 'Cancelada'
     where estado = 'Pendiente'
       and entidad = p_entidad
       and entidad_id = p_entidad_id
       and (p_reglas is null or regla_codigo = any (p_reglas))
    returning 1
  )
  select count(*) into v_cancelas from cancelas;
  return v_cancelas;
end
$$;

create function public.guardar_item(
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
      terminado_en = v_nuevo.terminado_en, clave_importacion = v_nuevo.clave_importacion
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

create function public.eliminar_item(p_id bigint) returns integer
language plpgsql as $$
begin
  update public.item set eliminado_en = now() where id = p_id and eliminado_en is null;
  if not found then
    raise exception 'El ítem % no existe', p_id;
  end if;
  update public.bloqueante set resuelto_en = now() where item_id = p_id and resuelto_en is null;
  return public.cancelar_alertas('item', p_id);
end
$$;

create function public.eliminar_ceremonia(p_id bigint) returns integer
language plpgsql as $$
declare
  v_canceladas integer := public.cancelar_alertas('ceremonia', p_id);
begin
  delete from public.ceremonia where id = p_id;
  return v_canceladas;
end
$$;

create function public.guardar_persona(p_data jsonb, p_clientes bigint[] default '{}', p_id bigint default null) returns bigint
language plpgsql as $$
declare
  v_id bigint := p_id;
  v_recibe text[] := array(select jsonb_array_elements_text(coalesce(p_data -> 'recibe', '[]'::jsonb)));
begin
  if public._limpiar(p_data ->> 'nombre') = '' then
    raise exception 'El nombre es obligatorio';
  end if;
  if v_id is null then
    insert into public.persona (nombre, correo, tipo, rol, frecuencia_reporte, recibe, activo)
    values (public._limpiar(p_data ->> 'nombre'), btrim(coalesce(p_data ->> 'correo', '')), p_data ->> 'tipo',
            coalesce(p_data ->> 'rol', ''), coalesce(p_data ->> 'frecuencia_reporte', ''), v_recibe,
            coalesce((p_data ->> 'activo')::boolean, true))
    returning id into v_id;
  else
    update public.persona set
      nombre = public._limpiar(p_data ->> 'nombre'), correo = btrim(coalesce(p_data ->> 'correo', '')),
      tipo = p_data ->> 'tipo', rol = coalesce(p_data ->> 'rol', ''),
      frecuencia_reporte = coalesce(p_data ->> 'frecuencia_reporte', ''), recibe = v_recibe,
      activo = coalesce((p_data ->> 'activo')::boolean, true)
    where id = v_id;
  end if;
  delete from public.persona_cliente where persona_id = v_id;
  insert into public.persona_cliente (persona_id, cliente_id)
  select v_id, unnest(p_clientes);
  return v_id;
end
$$;

create function public.importar_plan(p_filas jsonb, p_simular boolean default false, p_producto text default 'FieldOps')
returns jsonb
language plpgsql as $$
declare
  v_fila jsonb;
  v_nota jsonb;
  v_tipo text;
  v_existente public.item;
  v_responsable bigint;
  v_datos jsonb;
  v_resultado jsonb;
  v_item_id bigint;
  v_nuevos integer := 0;
  v_actualizados integer := 0;
  v_sin_cambios integer := 0;
  v_reprogramaciones integer := 0;
  v_notas integer := 0;
  v_personas_nuevas text[] := '{}';
begin
  for v_fila in select * from jsonb_array_elements(p_filas) loop
    select * into v_existente from public.item
     where clave_importacion = v_fila ->> 'clave' and eliminado_en is null limit 1;

    v_responsable := null;
    if coalesce(v_fila ->> 'responsable', '') <> '' then
      select id into v_responsable from public.persona
       where public._normalizar(nombre) = public._normalizar(v_fila ->> 'responsable') limit 1;
      if v_responsable is null then
        v_personas_nuevas := v_personas_nuevas || (v_fila ->> 'responsable');
        if not p_simular then
          insert into public.persona (nombre, tipo, rol, recibe)
          values (v_fila ->> 'responsable', 'equipo', 'Developer',
                  array['Bloqueantes', 'Vencimientos', 'Reprogramaciones', 'Ceremonias'])
          returning id into v_responsable;
        end if;
      end if;
    end if;

    if p_simular then
      if v_existente.id is null then v_nuevos := v_nuevos + 1; else v_actualizados := v_actualizados + 1; end if;
      continue;
    end if;

    v_datos := jsonb_build_object(
      'cliente', v_fila ->> 'cliente', 'actividad', v_fila ->> 'actividad', 'modulo', v_fila ->> 'modulo',
      'funcionalidad', v_fila ->> 'funcionalidad', 'fase', v_fila ->> 'fase', 'alcance', v_fila ->> 'alcance',
      'responsable_id', v_responsable, 'clave_importacion', v_fila ->> 'clave',
      'plan_ini', v_fila -> 'plan_ini', 'plan_fin', v_fila -> 'plan_fin',
      'plan_pruebas_ini', v_fila -> 'plan_pruebas_ini', 'plan_pruebas_fin', v_fila -> 'plan_pruebas_fin',
      'real_ini', v_fila -> 'real_ini', 'real_fin', v_fila -> 'real_fin',
      'real_pruebas_ini', v_fila -> 'real_pruebas_ini', 'real_pruebas_fin', v_fila -> 'real_pruebas_fin'
    );
    if coalesce(v_fila ->> 'producto', '') <> '' then
      v_datos := v_datos || jsonb_build_object('producto', v_fila ->> 'producto');
    elsif v_existente.id is null then
      v_datos := v_datos || jsonb_build_object('producto', p_producto);
    end if;
    if not (coalesce((v_fila ->> 'estado_deducido')::boolean, false) and v_existente.id is not null) then
      v_datos := v_datos || jsonb_build_object('estado', v_fila ->> 'estado');
    end if;

    v_resultado := public.guardar_item(v_datos, v_existente.id, '', 'Seguimiento', 'Importación');
    v_item_id := (v_resultado ->> 'id')::bigint;

    if v_existente.id is null then
      v_nuevos := v_nuevos + 1;
    elsif (v_resultado ->> 'sin_cambios')::boolean then
      v_sin_cambios := v_sin_cambios + 1;
    else
      v_actualizados := v_actualizados + 1;
      if jsonb_array_length(v_resultado -> 'cambios') > 0 then
        v_reprogramaciones := v_reprogramaciones + 1;
      end if;
    end if;

    foreach v_tipo in array array['Planificación', 'Ejecución'] loop
      for v_nota in
        select * from jsonb_array_elements(
          coalesce(v_fila -> case v_tipo when 'Planificación' then 'consid_plan' else 'consid_real' end, '[]'::jsonb))
      loop
        if not exists (
          select 1 from public.nota
           where item_id = v_item_id and public._normalizar(texto) = public._normalizar(v_nota ->> 'texto')
        ) then
          insert into public.nota (item_id, fecha, tipo, texto, autor)
          values (v_item_id, coalesce((v_nota ->> 'fecha')::date, public.hoy()), v_tipo, v_nota ->> 'texto', 'Importación');
          v_notas := v_notas + 1;
        end if;
      end loop;
    end loop;
  end loop;

  if not p_simular then
    perform public.registrar_auditoria('importacion', null, 'importar',
      format('%s nuevos, %s actualizados, %s notas', v_nuevos, v_actualizados, v_notas));
  end if;

  return jsonb_build_object(
    'filas', jsonb_array_length(p_filas), 'nuevos', v_nuevos, 'actualizados', v_actualizados,
    'sin_cambios', v_sin_cambios, 'reprogramaciones', v_reprogramaciones, 'notas', v_notas,
    'personas_nuevas', (select coalesce(jsonb_agg(distinct n), '[]'::jsonb) from unnest(v_personas_nuevas) as n)
  );
end
$$;
