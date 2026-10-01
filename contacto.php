<?php
/* =====================================================================
   RECEPTOR DEL FORMULARIO DE VALORACIÓN — qal.es
   =====================================================================

   Sustituye a Netlify Forms. La web se subió a Sered, donde el atributo
   `data-netlify` no significa nada: el formulario hacía POST contra la
   propia página y los datos se perdían en silencio.

   Qué hace, por orden:
     1. Comprueba el señuelo anti-robots (el campo `empresa`).
     2. Valida que estén los campos obligatorios.
     3. GUARDA EL CONTACTO EN UN CSV antes de nada.
     4. Intenta enviarlo por correo.
     5. Redirige a gracias.html.

   El paso 3 es deliberadamente ANTES del 4: si el correo falla, el
   contacto no se pierde. Es la diferencia entre "se nos cayó el correo
   un día" y "perdimos los clientes de ese día".
   ===================================================================== */

// ---------------------------------------------------------------------
// CONFIGURACIÓN — revisa estas tres líneas antes de subir el archivo
// ---------------------------------------------------------------------

// A donde llegan los avisos. Comprobado el 22/09/2026: este buzon
// existe en el hosting. Para mandarlo tambien a otro sitio, separa con
// coma: 'gestion@qal.es, operaciones@qal.es'
const DESTINO = 'tu-buzon@tudominio.es';

// Remitente. TIENE que ser una direccion del dominio qal.es: el SPF
// solo autoriza a este servidor a enviar correo de qal.es. Si pones un
// Gmail aqui, el aviso acaba en spam.
// Se usa la MISMA que el destino, a proposito: gestion@qal.es ya existe
// en el hosting, asi no hay que crear ni mantener un buzon mas ni otra
// contraseña que apuntar. El correo llega "de si mismo", que es feo pero
// funciona: la entrega es local, en este mismo servidor.
// NO pongas aqui el correo del visitante; ese va en Reply-To mas abajo.
const REMITENTE = 'web@tudominio.es';

// Dónde se guarda la copia. El '../' lo deja FUERA de public_html, así
// que no se puede descargar desde internet. No lo quites.
const FICHERO = __DIR__ . '/../contactos.csv';

// ---------------------------------------------------------------------

// Solo POST. Quien llegue aquí escribiendo la dirección, a la portada.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /', true, 303);
    exit;
}

function campo(string $k): string {
    // Sin saltos de línea: es lo que evita que alguien inyecte
    // cabeceras de correo a través de un campo del formulario.
    return trim(str_replace(["\r", "\n", "\0"], ' ', (string)($_POST[$k] ?? '')));
}

// 1. Señuelo. Es un campo oculto por CSS: una persona nunca lo rellena,
//    un robot de spam sí. Se responde como si todo hubiera ido bien
//    para no darle pistas.
if (campo('empresa') !== '') {
    header('Location: /gracias.html', true, 303);
    exit;
}

$nombre   = campo('nombre');
$telefono = campo('telefono');
$email    = campo('email');
$zona     = campo('zona');
$mensaje  = trim((string)($_POST['mensaje'] ?? ''));
$consent  = isset($_POST['consentimiento']);

// 2. Validación mínima, la misma que pide el HTML.
$errores = [];
if ($nombre === '')            $errores[] = 'nombre';
if ($telefono === '')          $errores[] = 'teléfono';
if ($zona === '')              $errores[] = 'zona';
if (!$consent)                 $errores[] = 'consentimiento';
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errores[] = 'email';

if ($errores) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Faltan datos</title>'
       . '<p style="font:16px/1.6 system-ui;max-width:34em;margin:3em auto;padding:0 1em">'
       . 'Falta por rellenar: <strong>' . htmlspecialchars(implode(', ', $errores), ENT_QUOTES) . '</strong>.<br><br>'
       . '<a href="/#contacto">Volver al formulario</a></p>';
    exit;
}

// 3. Copia en disco ANTES de intentar el correo.
$fila = [
    date('Y-m-d H:i:s'),
    $nombre, $telefono, $email, $zona,
    str_replace(["\r\n", "\n", "\r"], ' / ', $mensaje),
    $_SERVER['REMOTE_ADDR'] ?? '',
];

$nuevo = !file_exists(FICHERO);
if ($fh = @fopen(FICHERO, 'a')) {
    if (flock($fh, LOCK_EX)) {
        if ($nuevo) {
            fwrite($fh, "\xEF\xBB\xBF");   // para que Excel lea las tildes
            fputcsv($fh, ['fecha','nombre','telefono','email','zona','mensaje','ip'], ';');
        }
        fputcsv($fh, $fila, ';');
        flock($fh, LOCK_UN);
    }
    fclose($fh);
}

// 4. Aviso por correo.
$cuerpo = "Nueva solicitud de valoración desde qal.es\n"
        . str_repeat('=', 44) . "\n\n"
        . "Nombre:   $nombre\n"
        . "Teléfono: $telefono\n"
        . "Email:    " . ($email !== '' ? $email : '(no facilitado)') . "\n"
        . "Zona:     $zona\n\n"
        . "Mensaje:\n" . ($mensaje !== '' ? $mensaje : '(sin mensaje)') . "\n\n"
        . str_repeat('-', 44) . "\n"
        . "Recibido: " . date('d/m/Y H:i') . "\n"
        . "Consentimiento de datos: aceptado\n";

$cabeceras = [
    'From: QAL Web <' . REMITENTE . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: PHP/' . phpversion(),
];
// Reply-To con el correo del visitante: así se le contesta con
// «Responder» directamente, sin copiar la dirección a mano.
if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $cabeceras[] = 'Reply-To: ' . $nombre . ' <' . $email . '>';
}

@mail(
    DESTINO,
    '[Web] Valoración: ' . $nombre . ' — ' . $zona,
    $cuerpo,
    implode("\r\n", $cabeceras),
    '-f' . REMITENTE            // sobre del envío, ayuda con el SPF
);

// 5. Fuera. Un 303 evita que al recargar se reenvíe el formulario.
header('Location: /gracias.html', true, 303);
exit;
