/*
  Datos de conexión a la nube (Supabase). Se llenan una sola vez con el proyecto de ella.
  La clave pública (publishable) está hecha para ir en la app: sola no deja ver nada, porque la base
  solo entrega a cada persona su propia fila (reglas RLS). Con url vacía, la nube queda apagada.
*/
export const NUBE = {
  url: 'https://popspmvgjlxmgnaffmxt.supabase.co',
  clave: 'sb_publishable_blJv39_hvelwUonX4H3VOg_vEAxvMI-'
};
