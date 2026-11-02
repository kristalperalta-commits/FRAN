/*
  Datos de conexión a la nube (Supabase). Se llenan una sola vez con el proyecto de ella.
  La "clave anon" está hecha para ir en la app: sola no deja ver nada, porque la base
  solo entrega a cada persona su propia fila (reglas RLS). Con url vacía, la nube queda apagada.
*/
export const NUBE = {
  url: '',
  clave: ''
};
