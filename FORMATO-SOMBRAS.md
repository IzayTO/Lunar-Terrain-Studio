# Contrato de terreno, ciclo y sombras · versión 1

## Terreno

`lunar-height.png` es un PNG RGB de 8 bits por canal, sin perfil de color. **No es un PNG de escala de grises.** La altura está codificada con 16 bits repartidos entre R y G:

```js
q = R * 256 + G;
height = q / 65535 * 256 - 128;
q = Math.round((height + 128) / 256 * 65535);
R = q >> 8;
G = q & 255;
B = 0;
```

- 1025 × 1025 muestras, incluidas las dos fronteras; 4096 × 4096 metros.
- Fila superior = Z −2048; fila inferior = Z +2048.
- Columna izquierda = X −2048; derecha = X +2048; Y apunta arriba.
- Paso de 4 m; no invertir ni rotar la imagen; `flipY=false`, `NoColorSpace` en los juegos.
- Rango inclusivo [−128, +128] m; error máximo de cuantización aproximado 1.9532 mm.
- El editor bloquea exportaciones fuera de rango. Las correcciones requieren una acción explícita y son reversibles.
- Las normales y colisiones no se guardan como imágenes adicionales: el `lunar-terrain.js` existente las deriva de estas mismas alturas, con la misma división de triángulos. El editor usa esa división para seleccionar posiciones. Los juegos conservan sus anillos de detalle existentes, de 4, 16 y 32 m; su horizonte lejano sigue simplificado.

## Trayectoria

`solar.js` contiene las expresiones originales de `orbit(hour)` y `linkedPhase`. La integración incorpora una copia independiente llamada `lts-solar.js`.

- `LUNAR_DAY = 29.53059`.
- `hour` de 0 a 24; ciclo = `hour / 24`; 24 cierra el ciclo en 0.
- `h = (hour - 12) / 24 * 2π`; `lat = 25π/180`; `dec = .0269 sin(h)`.
- Se conserva la normalización, los signos de X/Y/Z, la libración representativa terrestre y el sentido de fase del original.
- `sun` y `earth` son vectores unitarios **hacia** las fuentes; los rayos llegan en la dirección opuesta.
- Fracción terrestre iluminada = `(1 - dot(sun, earth)) / 2`.
- Luz terrestre = `illumination ** 1.45 * .036`.
- Luz solar en el material = `max(dot(normal, sun), 0) * visibility * 1.38`, tinte (1, .98, .93); luz terrestre con tinte (.46, .63, 1). Se conserva el término ambiente .000025.
- El editor no incluye discos, esferas, líneas de órbita, resplandor solar ni planetas. La dirección sólo entra en el cálculo de iluminación.
- Con «Luz de trabajo» mayor que 0 se añade iluminación de edición; no se exporta esa ayuda. La textura del regolito y la adaptación ocular de los juegos no se reproducen: el editor muestra un material sencillo de albedo .28, preservando el contrato de iluminación.

En el 35 % (`hour=8.4`):

```json
{
  "sun": [0.8088254231141226, 0.5233916790025581, 0.2680719777879511],
  "earth": [-0.5860048996402353, 0.7371641110534738, 0.3364332489103592],
  "phase": 0.7503243941769793,
  "illumination": 0.4989808863423652,
  "earthshine": 0.013137846109584342
}
```

## `lunar-shadows.bin`

Contenedor binario independiente. Se exporta junto a `lunar-solar.json`, una copia legible de su cabecera.

| Posición | Contenido |
|---|---|
| Bytes 0–3 | ASCII `LTSB` |
| Bytes 4–7 | Longitud en bytes de la cabecera JSON, uint32 little-endian |
| Desde byte 8 | Cabecera JSON UTF-8 |
| A continuación | Máscaras de cada instante: Sol, Tierra, Sol, Tierra… |

La cabecera incluye `format: lunar-terrain-shadows`, `version: 1`, tamaño del mundo, resolución, separación, algoritmo, orientación, `heightSHA256` y `samples`. Cada muestra contiene `hour`, `cycle`, `sun[3]`, `earth[3]`, `phase`, `illumination` y `earthshine`. Los instantes están ordenados e incluyen 0 y 24.

Cada máscara ocupa `ceil(resolution * resolution / 8)` bytes. El índice de muestra espacial es `z * resolution + x`. Un bit 1 significa visible, un bit 0 significa ocluido; los bits se guardan del menos significativo al más significativo:

```js
visible = (mask[index >> 3] >> (index & 7)) & 1;
```

La suma SHA-256 corresponde a **todos los bytes R,G intercalados**, en orden de filas, sin cabecera PNG ni B/A. Así se puede verificar el terreno aunque el PNG cambie de compresión. Nunca se aceptan sombras de un terreno distinto.

## Método y precisión

El cálculo se ejecuta en un Web Worker. Evalúa un barrido direccional de horizonte sobre las **1025² alturas del PNG cuantizado que se exportará**, interpolando el horizonte entre líneas vecinas. Después conserva muestras cada 16, 8 o 4 metros según la calidad seleccionada. Sol y Tierra se calculan por separado; el observador se sitúa 0.24 m por encima de la muestra del terreno.

Es un método de oclusión sobre una rejilla, con aproximación espacial en direcciones oblicuas. No es un trazador de rayos continuo ni una reproducción bit a bit de la caché dinámica del juego. Las direcciones astronómicas sí son las originales. La vista en vivo usa una caché global con marchado de rayos; «Ver sombras precalculadas» permite inspeccionar el resultado que se exportará.

Se empieza con 25 instantes. Un sondeo de 129² detecta variación de visibilidad solar/terrestre y añade instantes por bisección. Cerca del horizonte (`abs(sun.y) < .14`) se refina hasta intervalos de 0.0625 horas normalizadas; también se refinan intervalos con más del 1.2 % de cambio de visibilidad. Hay un límite de 160 instantes para acotar memoria y tiempo. Esta tolerancia es un criterio de refinamiento, no una garantía de error máximo. El original produjo 94 instantes.

Las máscaras se interpolan espacialmente y entre los dos tiempos adyacentes para suavizar el movimiento. Las sombras muy pequeñas dependen de la resolución exportada. No se incluyen sombras de objetos, vehículos ni construcciones. Los límites exteriores del mapa no suponen terreno adicional fuera de los 4096 m. El cálculo puede cancelarse; ningún resultado parcial se aplica.

## Consumidor de referencia

`lts-game-shadows.js` valida formato, tamaño, hash del PNG y todos los vectores solares/terrestres antes de activar el paquete. Resuelve el instante del ciclo desde la dirección solar original y alimenta la ventana local de 256 m de `LunarLightCache`.

El adaptador conserva literalmente `heightGLSL`, `cacheGLSL` y los shaders originales. Así mantiene sus claves de conversión a TSL en la App. La textura de datos invierte las filas únicamente para la ruta WebGPU porque la migración TSL existente usa `uv.flipY()` para esa caché. Fuera de la ventana local permanece la oclusión dinámica original. No se reduce el detalle de geometría ni se altera la colisión del juego.

Si falta el archivo, cambia el terreno o no coincide el contrato, continúa la caché dinámica original. El estado puede consultarse en la consola como `LunarTerrainShadows`. La integración está preparada para los commits documentados en `COMPATIBILIDAD.json`; no garantiza futuras versiones ni sustituye las pruebas en un iPhone o visor real.
