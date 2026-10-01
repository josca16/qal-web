# qal.es — web de captación para una inmobiliaria

Web corporativa de **QAL Agentes Inmobiliarios** (Sevilla), diseñada, desarrollada y publicada por mí.
En producción en **[qal.es](https://qal.es)** desde septiembre de 2026, sustituyendo al WordPress anterior.

No es un portal de inmuebles: es una página de captación con un único objetivo, que el propietario
que se plantea vender pida una valoración.

## Lo más destacado

- **Recorrido en primera persona por una vivienda, sincronizado con el scroll.** Se dibuja sobre un
  `<canvas>` a partir de fotogramas extraídos de un vídeo generado con IA. Entre fotograma y fotograma
  se interpola por opacidad: el scroll pasa de cambiar la imagen en el 46 % de los pasos al 98 %.
- **De 19,9 MB a 4,6 MB en escritorio y 1,1 MB en móvil.** Dos pistas de fotogramas según el
  dispositivo (120 a 1440 px / 48 a 720 px), carga progresiva en lotes de seis y, si el usuario baja más
  rápido de lo que carga, se muestra el fotograma disponible más cercano en lugar de un hueco.
- **Mobile-first.** El tráfico llega por WhatsApp, así que todo se decidió primero en pantalla de
  teléfono: tarjeta Open Graph para la vista previa, campos a 16 px para evitar el zoom de iOS,
  teclados adecuados con `inputmode`.
- **Formulario de captación en PHP** sin dependencias: guarda cada contacto en un CSV fuera del
  directorio público *antes* de enviar el aviso por correo (si el correo falla, el contacto no se
  pierde) y filtra robots con un campo trampa.
- **Accesibilidad y SEO técnico:** jerarquía de encabezados correcta, contraste medido sobre los
  fotogramas (con `text-shadow` y `drop-shadow` donde hace falta), `sitemap.xml`, `robots.txt`,
  redirecciones 301 desde las URLs del sitio anterior.
- **Sin cookies ni rastreadores**, por lo que no necesita banner de consentimiento.

## Stack

HTML, CSS y JavaScript sin framework ni paso de compilación, más PHP para el formulario.
Desplegada en un hosting compartido con cPanel (LiteSpeed). Única dependencia externa: Google Fonts.

| Archivo | Qué hace |
|---|---|
| `index.html` | La portada, seis secciones a pantalla completa |
| `style.css` | Diseño y adaptación a móvil |
| `script.js` | Recorrido del scroll, menú y ventana modal |
| `contacto.php` | Recibe el formulario: CSV + correo |
| `legal.html` / `gracias.html` | Textos legales y confirmación de envío |
| `assets/frames_ancho/`, `assets/frames_movil/` | Fotogramas WebP del recorrido |

## Problemas resueltos por el camino

- `overflow-x: hidden` en un ancestro rompe `position: sticky` (convierte el elemento en contenedor
  de scroll). Solución: `overflow-x: clip`.
- Una consulta `@container` no puede redefinir variables en `:root`, que está por encima del contenedor.
- Las media queries no añaden especificidad: el orden en el CSS decide, y los ajustes van al final.

## Ejecutarla en local

```bash
php -S localhost:8000
```

En `contacto.php` hay que poner el buzón de destino y el remitente reales (aquí van valores de ejemplo).

---

Desarrollado por **José Carlos Membrive Martínez** · [Portfolio](https://portfolio-josecarlos.vercel.app/) · [LinkedIn](https://www.linkedin.com/in/jose-carlos-membrive/)
