insert into public.config (clave, valor) values
  ('po_nombre', 'Verónica Rodríguez'),
  ('po_correo', 'vrodriguez@ises.com.co'),
  ('app_url', 'http://localhost:5173');

insert into public.producto (nombre, descripcion) values ('FieldOps', 'Plataforma de operación en campo');

insert into public.smtp_config (id) values (true);

insert into public.regla_alerta (codigo, nombre, descripcion, categoria, destinatarios, parametro, hora_envio) values
  ('BLOQUEO_NUEVO', 'Nuevo bloqueante', 'Un ítem del backlog pasa a bloqueado (envío inmediato)', 'Bloqueantes',
   array['responsable', 'po', 'stakeholders'], 0, '00:00'),
  ('BLOQUEO_RESUELTO', 'Bloqueo resuelto', 'Un ítem deja de estar bloqueado (envío inmediato)', 'Bloqueantes',
   array['responsable', 'po', 'stakeholders'], 0, '00:00'),
  ('BLOQUEO_ESCALAR', 'Escalamiento de bloqueante', 'Sigue bloqueado más de N horas; se repite cada 24 h', 'Escalamientos',
   array['stakeholders', 'lider_tecnico', 'po'], 48, '00:00'),
  ('VENCIMIENTO', 'Vencimiento de fecha planificada',
   'Un correo diario por responsable con sus ítems vencidos o a N días de su fecha fin planificada', 'Vencimientos',
   array['responsable'], 2, '08:00'),
  ('REPROGRAMACION', 'Reprogramación', 'Cambia una fecha planificada de un ítem (envío inmediato)', 'Reprogramaciones',
   array['responsable', 'po'], 0, '00:00'),
  ('CEREMONIA', 'Recordatorio de ceremonia', 'N horas antes y 1 hora antes de cada ceremonia', 'Ceremonias',
   array['audiencia'], 24, '00:00'),
  ('ACUERDO_VENCIDO', 'Acuerdo vencido', 'Un acuerdo de ceremonia pasó su fecha límite sin cumplirse', 'Vencimientos',
   array['responsable', 'po'], 0, '08:00'),
  ('RESUMEN_SEMANAL', 'Resumen semanal', 'Avance por cliente, bloqueos, atrasos y próximos hitos cada lunes', 'Resumen semanal',
   array['po', 'stakeholders'], 0, '07:30');
