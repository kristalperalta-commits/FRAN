# Mis Préstamos, módulo 1

App para llevar clientes, préstamos, pagos, caja y agenda de cobros. Funciona en el
teléfono y en el computador, sin internet y sin costo.

## Abrirla en el computador

Doble clic en **Mis Prestamos**, el acceso directo del escritorio. También sirve
`ABRIR-EN-EL-COMPUTADOR.bat` en esta carpeta. El navegador abre la app y queda una ventana
negra minimizada en la barra de tareas: déjala abierta mientras la usas. Para terminar,
cierra esa ventana.

Los datos quedan guardados en ese navegador del computador. Haz una copia desde
Ajustes → Descargar copia de vez en cuando.

## Caja virtual mes a mes

En Caja está el cuadro "Virtual mes a mes": por cada mes, entró, salió y acumulado. Si el
acumulado queda en negativo, la app lo muestra como "Plata de tu pareja usada". Para
arrancar con la deuda que ya tenías, usa "Saldo inicial", caja Virtual, y marca
"Debo esa plata".

## Entrada con Face ID

Cada aparato la activa una vez. Se maneja en Yo, Entrada con Face ID. Si la llave se pierde, en
"No puedo entrar" se usa la contraseña de Fran en la nube, con internet. Es un candado para
abrir la app; no cifra lo guardado en el aparato.

## Temas

En Ajustes, arriba, se elige entre Oscuro, Claro, Noche morada, Verde menta, Rosa y Dorado.
El Claro tiene fondo gris clarito, no blanco. El tema se recuerda en cada aparato.

## Instalarla en el teléfono

La app tiene que estar publicada en una dirección con candado (https). Eso se hace
gratis en GitHub Pages o Netlify y es el paso siguiente. Una vez publicada:

- **iPhone:** abrir la dirección en Safari → Compartir → Añadir a pantalla de inicio.
- **Android:** abrir en Chrome → menú → Instalar aplicación.

Las instrucciones también están dentro de la app, en Ajustes.

## Probar con los casos de ejemplo

Los casos de ejemplo quedan solo para las pruebas automáticas (`js/casos.js`). Ya no se
pueden cargar desde la app, para que nadie borre datos reales por error.

## Para programadores

`npm test` dentro de `app/` corre las pruebas del motor y de los datos. La
especificación está en `../ESPECIFICACION-MODULO-1.md`.
