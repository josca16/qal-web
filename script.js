document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================================================
     SECUENCIA DE IMÁGENES SINCRONIZADA CON EL SCROLL

     Qué cambió el 18/09/2026 y por qué (el diseño NO se ha tocado):

     1. DOS PISTAS. Antes se servían los mismos 240 fotogramas a 1920 px a
        todo el mundo: 19,9 MB. En un móvil con 4G eso son varios segundos
        de pantalla en blanco, y el tráfico de QAL llega por WhatsApp, es
        decir, casi todo móvil. Ahora: 120 fotogramas a 1440 px en
        escritorio (4,5 MB) y 48 a 720 px en móvil (0,8 MB).

     2. CARGA PROGRESIVA. Antes se lanzaban las 240 peticiones a la vez en
        el mismo instante en que cargaba la página, compitiendo con el CSS
        y las tipografías, que son lo que bloquea el primer pintado. Ahora
        van los cuatro primeros —los que se ven nada más entrar— y el
        resto detrás, de uno en uno, cuando el navegador está libre.

     3. MOVIMIENTO REDUCIDO. Antes, quien tuviera activado «reducir
        movimiento» se descargaba los 19,9 MB igual para no ver el efecto.
        Ahora se baja un solo fotograma y se deja fijo.

        OJO, ESTO CONFUNDE: si TÚ tienes activado «reducir movimiento» en
        Windows, verás la web sin recorrido y parecerá que está rota. No
        lo está: estás viendo justo lo que ve un visitante con esa
        preferencia. Para comprobarlo, abre la consola del navegador (F12)
        y pega esto:

            matchMedia('(prefers-reduced-motion: reduce)').matches

        Si sale `true`, es eso. Se quita en Windows en
        Configuración → Accesibilidad → Efectos visuales → Efectos de
        animación.

        Si prefieres que el recorrido se vea SIEMPRE, aunque el visitante
        haya pedido menos movimiento, pon la constante de abajo en `false`.
        Piénsalo dos veces: hay gente a la que un fondo que se mueve a
        pantalla completa le provoca mareo de verdad, y por eso existe esa
        preferencia. El texto y el argumento se leen igual con el fondo
        quieto.

     Las carpetas viejas (assets/frames_webp y assets/frames) siguen ahí
     por si quieres volver atrás; ya no las usa nadie y puedes borrarlas.
     Para recuperar los 240 fotogramas de antes, apunta `ruta` y `total`
     a assets/frames_webp y pon total: 240.
     ========================================================================== */

  /* Ponlo en false para que el recorrido se mueva también para quien
     tenga activado «reducir movimiento» en su sistema. Ver la nota de
     arriba antes de tocarlo. */
  const RESPETAR_MOVIMIENTO_REDUCIDO = false;

  const PISTAS = {
    ancho: { ruta: 'assets/frames_ancho', total: 120 },
    movil: { ruta: 'assets/frames_movil', total: 48 },
  };

  const canvas = document.getElementById('scroll-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const movimientoReducido = RESPETAR_MOVIMIENTO_REDUCIDO
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // La pista se elige UNA vez, al cargar. No se recambia al girar el
  // móvil: 48 fotogramas ya descargados valen más que 120 perfectos a
  // mitad de visita.
  const pista = window.innerWidth >= 820 ? PISTAS.ancho : PISTAS.movil;
  const TOTAL_FRAMES = pista.total;

  const images = new Array(TOTAL_FRAMES);
  let targetFrame = 0;
  let currentFrame = 0;
  let ultimoPintado = -1;

  const getFramePath = (index) =>
    `${pista.ruta}/frame_${String(index + 1).padStart(4, '0')}.webp`;

  // Ajustar resolución del canvas según DPI del dispositivo
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ultimoPintado = -1;
    renderFrame(currentFrame);
  }

  const cargado = (img) => !!img && img.complete && img.naturalWidth > 0;

  // 'object-fit: cover' a mano, que el canvas no lo trae.
  function dibujar(img) {
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const nw = img.naturalWidth * scale;
    const nh = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - nw) / 2, (ch - nh) / 2, nw, nh);
  }

  /* ------------------------------------------------------------------
     POR QUÉ ESTO RECIBE UN DECIMAL Y NO UN ENTERO

     Antes aquí entraba Math.round(currentFrame), o sea que sólo podía
     pintar 120 imágenes distintas. Y los 120 fotogramas se reparten por
     TODO el scroll de la página: 6 secciones de 100vh son unos 6.000 px,
     así que tocaba a un fotograma cada 50 px. Una muesca de rueda en
     Windows son 100 px: cada clic saltaba dos fotogramas de golpe. Eso
     era el pasar a trompicones.

     La solución que NO se ha usado es subir el número de fotogramas:
     240 pesan 9 MB y el motivo de bajarlos a 120 fue justamente el peso
     (de 19,9 MB a 4,5 MB), y el tráfico de QAL llega por WhatsApp, o
     sea móvil.

     Lo que se hace es interpolar: se pinta el fotograma entero y encima
     el siguiente con la opacidad de la parte decimal. En 0,0 se ve sólo
     el primero; en 0,5 los dos al 50 %; en 1,0 sólo el segundo. Entre
     dos fotogramas contiguos la cámara se ha movido muy poco, así que
     la mezcla se lee como movimiento continuo y no como una
     transparencia.

     Coste: una llamada más a drawImage por cuadro, que va por GPU. Cero
     bytes de descarga, cero cambios en el diseño, y el recorrido sigue
     repartido por toda la página como estaba.
     ------------------------------------------------------------------ */
  function renderFrame(pos) {
    // Un cuarto de por ciento de fotograma: por debajo de eso no hay
    // nada que ver y sólo serían repintados tirados a la basura.
    if (Math.abs(pos - ultimoPintado) < 0.004) return;

    const base = Math.floor(pos);
    const fraccion = pos - base;

    // Si el fotograma que toca aún no ha llegado, se enseña el cargado
    // más cercano y NO se mezcla: mezclar con uno lejano daría un
    // fundido raro en vez de movimiento.
    const iBase = masCercanoCargado(base);
    const imgBase = images[iBase];
    if (!cargado(imgBase)) return;

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    dibujar(imgBase);

    if (iBase === base && fraccion > 0.002 && base + 1 < TOTAL_FRAMES) {
      const imgSig = images[base + 1];
      if (cargado(imgSig)) {
        ctx.globalAlpha = fraccion;
        dibujar(imgSig);
        ctx.globalAlpha = 1;
      }
    }

    ultimoPintado = pos;
  }

  /* El fotograma cargado más cercano al que toca. Mientras la secuencia
     se va descargando, esto evita que el fondo se quede en blanco si el
     visitante baja rápido: enseña el más próximo que ya tenga. */
  function masCercanoCargado(index) {
    if (cargado(images[index])) return index;
    for (let d = 1; d < TOTAL_FRAMES; d++) {
      if (cargado(images[index - d])) return index - d;
      if (cargado(images[index + d])) return index + d;
    }
    return index;
  }

  function cargarFrame(i, alTerminar) {
    if (i >= TOTAL_FRAMES || images[i]) {
      if (alTerminar) alTerminar();
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.src = getFramePath(i);
    img.onload = () => {
      /* Al llegar un fotograma nuevo hay que repintar: puede ser el que
         tocaba, o el vecino que le faltaba a la mezcla. Se fuerza
         invalidando el último pintado, porque `pos` no ha cambiado y el
         corte de 0,004 lo descartaría. */
      ultimoPintado = -1;
      renderFrame(currentFrame);
      if (alTerminar) alTerminar();
    };
    img.onerror = () => { if (alTerminar) alTerminar(); };
    images[i] = img;
  }

  /* Seis a la vez, no de una en una.
     En serie son 120 idas y vueltas al servidor encadenadas: cada
     fotograma espera a que termine el anterior, así que la latencia se
     suma 120 veces. Mientras tanto, quien baje rápido ve saltos gordos,
     porque masCercanoCargado sólo puede enseñar lo poco que hay.
     Seis es el término medio: satura la conexión lo justo para que la
     secuencia esté lista pronto, sin robarle ancho de banda al CSS y a
     las tipografías, que son lo que bloquea el primer pintado. */
  const EN_PARALELO = 6;

  function cargarResto(inicio) {
    let siguiente = inicio;
    let enVuelo = 0;

    function bombear() {
      while (enVuelo < EN_PARALELO && siguiente < TOTAL_FRAMES) {
        const i = siguiente++;
        if (images[i]) continue;   // los primeros ya se pidieron aparte
        enVuelo++;
        cargarFrame(i, () => { enVuelo--; bombear(); });
      }
    }

    bombear();
  }

  // Calcular el frame objetivo basado en el scroll actual
  function calculateTargetFrame() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) return;

    const scrollFraction = Math.max(0, Math.min(1, scrollTop / maxScroll));
    targetFrame = scrollFraction * (TOTAL_FRAMES - 1);
  }

  /* Bucle continuo con suavizado (lerp).
     El umbral baja de 0,01 a 0,002 porque ahora sí hay algo que pintar
     por debajo de un fotograma entero: con la interpolación, esa cola
     final del movimiento se ve. Con 0,01 el recorrido se paraba de
     golpe a un centésimo de llegar. */
  function animationLoop() {
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.002) {
      currentFrame += diff * 0.18;
      renderFrame(currentFrame);
    }

    requestAnimationFrame(animationLoop);
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });

  if (movimientoReducido) {
    /* Un solo fotograma, quieto. Quien pide menos movimiento no debe
       pagar 4,5 MB por un efecto que no va a ver. */
    cargarFrame(0);
    resizeCanvas();
  } else {
    // Los primeros, ya: son los que se ven al entrar.
    for (let i = 0; i < Math.min(4, TOTAL_FRAMES); i++) cargarFrame(i);

    const arrancarResto = () => cargarResto(0);
    if ('requestIdleCallback' in window) {
      requestIdleCallback(arrancarResto);
    } else {
      setTimeout(arrancarResto, 400);
    }

    window.addEventListener('scroll', calculateTargetFrame, { passive: true });
    resizeCanvas();
    calculateTargetFrame();
    currentFrame = targetFrame;
    requestAnimationFrame(animationLoop);
  }

  /* ==========================================================================
     CONTROL DEL MODAL DE INFORMACIÓN (LAS 4 TARJETAS)
     ========================================================================== */
  const infoModalBackdrop = document.getElementById('infoModalBackdrop');
  const closeInfoModalBtn = document.getElementById('closeInfoModalBtn');
  const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
  const cardPanels = document.querySelectorAll('.info-card-panel');
  const cardTriggers = document.querySelectorAll('[data-open-card]');

  function showCard(cardId) {
    if (!infoModalBackdrop) return;

    // Activar backdrop
    infoModalBackdrop.classList.add('is-active');
    infoModalBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Activar pestaña correspondiente
    modalTabBtns.forEach((tab) => {
      if (tab.getAttribute('data-tab-target') === cardId) {
        tab.classList.add('is-active');
      } else {
        tab.classList.remove('is-active');
      }
    });

    // Activar panel de tarjeta
    cardPanels.forEach((panel) => {
      if (panel.id === cardId) {
        panel.classList.add('is-active');
      } else {
        panel.classList.remove('is-active');
      }
    });

    if (closeInfoModalBtn) closeInfoModalBtn.focus();
  }

  function closeInfoModal() {
    if (!infoModalBackdrop) return;
    infoModalBackdrop.classList.remove('is-active');
    infoModalBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Event listeners para abrir tarjetas desde cualquier botón/píldora/dropdown
  cardTriggers.forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const cardId = trigger.getAttribute('data-open-card');
      showCard(cardId);
    });
  });

  // Selector de pestañas dentro del modal
  modalTabBtns.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab-target');
      showCard(targetId);
    });
  });

  // Control de apertura/cierre de desplegables por click/touch
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  dropdownToggles.forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = toggle.closest('.has-dropdown');
      const isOpen = parent.classList.contains('is-open');

      // Cerrar otros dropdowns
      document.querySelectorAll('.has-dropdown.is-open').forEach((d) => d.classList.remove('is-open'));

      if (!isOpen) {
        parent.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-dropdown')) {
      document.querySelectorAll('.has-dropdown.is-open').forEach((d) => {
        d.classList.remove('is-open');
        const t = d.querySelector('.dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
  });

  if (closeInfoModalBtn) {
    closeInfoModalBtn.addEventListener('click', closeInfoModal);
  }

  if (infoModalBackdrop) {
    infoModalBackdrop.addEventListener('click', (e) => {
      if (e.target === infoModalBackdrop) {
        closeInfoModal();
      }
    });
  }

  /* ==========================================================================
     CONTROL DEL MENÚ MÓVIL
     ========================================================================== */
  const openMenuBtn = document.getElementById('openMenuBtn');
  const closeMenuBtn = document.getElementById('closeMenuBtn');
  const mobileNavModal = document.getElementById('mobileNavModal');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link:not(.mobile-card-trigger)');
  const mobileCardTriggers = document.querySelectorAll('.mobile-card-trigger');

  function openMobileMenu() {
    if (!mobileNavModal) return;
    mobileNavModal.classList.add('is-active');
    mobileNavModal.setAttribute('aria-hidden', 'false');
    openMenuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    closeMenuBtn.focus();
  }

  function closeMobileMenu() {
    if (!mobileNavModal) return;
    mobileNavModal.classList.remove('is-active');
    mobileNavModal.setAttribute('aria-hidden', 'true');
    openMenuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    openMenuBtn.focus();
  }

  if (openMenuBtn && closeMenuBtn && mobileNavModal) {
    openMenuBtn.addEventListener('click', openMobileMenu);
    closeMenuBtn.addEventListener('click', closeMobileMenu);

    mobileNavModal.addEventListener('click', (e) => {
      if (e.target === mobileNavModal) closeMobileMenu();
    });

    mobileNavLinks.forEach((link) => {
      link.addEventListener('click', closeMobileMenu);
    });

    mobileCardTriggers.forEach((btn) => {
      btn.addEventListener('click', () => {
        closeMobileMenu();
      });
    });
  }

  // Tecla Escape global para cerrar cualquier modal abierto
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (infoModalBackdrop && infoModalBackdrop.classList.contains('is-active')) {
        closeInfoModal();
      } else if (mobileNavModal && mobileNavModal.classList.contains('is-active')) {
        closeMobileMenu();
      }
    }
  });

  /* ==========================================================================
     ANIMACIÓN DE APARICIÓN DE SECCIONES AL HACER SCROLL
     ========================================================================== */
  const sections = document.querySelectorAll('.story-section');
  const observerOptions = {
    threshold: 0.25
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const content = entry.target.querySelector('.section-content');
      if (content) {
        if (entry.isIntersecting) {
          content.style.opacity = '1';
          content.style.transform = 'translateY(0)';
        } else {
          content.style.opacity = '0.35';
          content.style.transform = 'translateY(15px)';
        }
      }
    });
  }, observerOptions);

  sections.forEach((section) => {
    sectionObserver.observe(section);
  });
});
