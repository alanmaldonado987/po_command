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
       pe.correo as responsable_correo
from calculado c
left join public.producto pr on pr.id = c.producto_id
left join public.cliente cl on cl.id = c.cliente_id
left join public.actividad ac on ac.id = c.actividad_id
left join public.modulo m on m.id = c.modulo_id
left join public.persona pe on pe.id = c.responsable_id;

create view public.v_bloqueante_abierto with (security_invoker = true) as
select b.id, b.item_id, b.motivo, b.severidad, b.abierto_en, b.escalado_en,
       i.codigo, i.titulo, i.cliente_id, i.cliente, i.actividad, i.modulo, i.responsable, i.fecha_compromiso
from public.bloqueante b
join public.v_item i on i.id = b.item_id
where b.resuelto_en is null;

create view public.v_ceremonia with (security_invoker = true) as
select c.*, cl.nombre as cliente
from public.ceremonia c
left join public.cliente cl on cl.id = c.cliente_id;

create view public.v_acuerdo with (security_invoker = true) as
select a.*, p.nombre as responsable, p.correo as responsable_correo
from public.acuerdo a
left join public.persona p on p.id = a.responsable_id;

create view public.v_persona with (security_invoker = true) as
select p.*,
       coalesce(array_agg(pc.cliente_id) filter (where pc.cliente_id is not null), '{}') as cliente_ids,
       coalesce(string_agg(cl.nombre, ', ' order by cl.nombre), '') as clientes
from public.persona p
left join public.persona_cliente pc on pc.persona_id = p.id
left join public.cliente cl on cl.id = pc.cliente_id
group by p.id;
