import { goto } from '$app/navigation';
  import TeamSwitcher, { activeTeam } from '../../lib/components/TeamSwitcher.svelte';
  import RolesManagement from '../../lib/components/RolesManagement.svelte';
  import CollaboratorsManagement from '../../lib/components/CollaboratorsManagement.svelte';
  import RotationManagement from '../../lib/components/RotationManagement.svelte';
  import { db } from '../../lib/services/DatabaseService.js';
  import '../../lib/styles/layout.css';
  import { onMount, onDestroy } from 'svelte';
  
  let currentTeamId = 0;
  let isLoading = false;
  let isChangingTeam = false;
  
  // Suscribirse a cambios de equipo
  const unsubscribeTeam = activeTeam.subscribe(async (teamId) => {
    if (teamId !== currentTeamId && !isChangingTeam) {
      isChangingTeam = true;
      isLoading = true;
      
      try {
        // Cambiar la base de datos al nuevo equipo
        await db.switchTeam(teamId);
        currentTeamId = teamId;
      } catch (error) {
        console.error('Error cambiando de equipo:', error);
      } finally {
        isLoading = false;
        isChangingTeam = false;
      }
    }
  });

  function goBack() {
    goto('/');
  }
  
  onMount(() => {
    // Forzar reflow para que las barras de desplazamiento se actualicen
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      
      // Solución para la barra de desplazamiento arrastrable
      const mainElement = document.querySelector('main');
      if (mainElement) {
        // Crear un contenedor para la barra de desplazamiento
        const scrollbarTrack = document.createElement('div');
        scrollbarTrack.className = 'custom-scrollbar-track';
        scrollbarTrack.style.position = 'fixed';
        scrollbarTrack.style.top = '0';
        scrollbarTrack.style.right = '0';
        scrollbarTrack.style.width = '10px'; // Más delgada para ser sutil
        scrollbarTrack.style.height = '100%';
        scrollbarTrack.style.background = 'rgba(0, 0, 0, 0.1)'; // Sutil, casi invisible
        scrollbarTrack.style.zIndex = '9999';
        
        // Crear el "thumb" de la barra de desplazamiento
        const scrollbarThumb = document.createElement('div');
        scrollbarThumb.className = 'custom-scrollbar-thumb';
        scrollbarThumb.style.position = 'absolute';
        scrollbarThumb.style.top = '0';
        scrollbarThumb.style.right = '0';
        scrollbarThumb.style.width = '6px'; // Más delgada para estética
        scrollbarThumb.style.borderRadius = '3px';
        scrollbarThumb.style.background = 'rgba(52, 152, 219, 0.5)'; // Azul de la interfaz
        scrollbarThumb.style.cursor = 'pointer';
        scrollbarThumb.style.transition = 'all 0.2s';
        scrollbarThumb.style.zIndex = '10000';
        scrollbarThumb.style.minHeight = '50px'; // Altura mínima para mejor agarre
        scrollbarThumb.style.opacity = '0.5'; // Semi-transparente inicialmente
        scrollbarThumb.style.boxShadow = '0 0 3px rgba(0, 0, 0, 0.2)'; // Sutil sombreado
        
        // Añadir efectos hover
        scrollbarThumb.addEventListener('mouseenter', () => {
          scrollbarThumb.style.width = '8px'; // Ligeramente más ancho al hacer hover
          scrollbarThumb.style.background = 'rgba(52, 152, 219, 0.8)';
          scrollbarThumb.style.opacity = '0.9';
        });
        
        scrollbarThumb.addEventListener('mouseleave', () => {
          if (!isDragging) {
            scrollbarThumb.style.width = '6px';
            scrollbarThumb.style.background = 'rgba(52, 152, 219, 0.5)';
            scrollbarThumb.style.opacity = '0.5';
          }
        });
        
        scrollbarTrack.appendChild(scrollbarThumb);
        document.body.appendChild(scrollbarTrack);
        
        // Función para actualizar la altura y posición del thumb
        const updateScrollbarThumb = () => {
          const scrollRatio = mainElement.scrollHeight / mainElement.clientHeight;
          const thumbHeight = Math.max(50, mainElement.clientHeight / scrollRatio);
          scrollbarThumb.style.height = `${thumbHeight}px`;
          
          const scrolled = mainElement.scrollTop / (mainElement.scrollHeight - mainElement.clientHeight);
          const thumbPosition = scrolled * (mainElement.clientHeight - thumbHeight);
          scrollbarThumb.style.top = `${thumbPosition}px`;
        };
        
        // Actualizar al inicio
        updateScrollbarThumb();
        
        // Actualizar cuando se hace scroll
        mainElement.addEventListener('scroll', updateScrollbarThumb);
        
        // Manejar clic en el track
        scrollbarTrack.addEventListener('click', (e) => {
          // Asegurarse de que no se procesó un clic en el thumb
          if (e.target === scrollbarTrack) {
            const clickPosition = e.clientY;
            const trackRect = scrollbarTrack.getBoundingClientRect();
            const thumbHeight = parseFloat(scrollbarThumb.style.height);
            const trackHeight = trackRect.height;
            
            // Calcular posición proporcional
            let newScrollPosition;
            if (clickPosition < trackRect.top + thumbHeight / 2) {
              newScrollPosition = 0;
            } else if (clickPosition > trackRect.bottom - thumbHeight / 2) {
              newScrollPosition = mainElement.scrollHeight - mainElement.clientHeight;
            } else {
              const clickRatio = (clickPosition - trackRect.top - thumbHeight / 2) / (trackHeight - thumbHeight);
              newScrollPosition = clickRatio * (mainElement.scrollHeight - mainElement.clientHeight);
            }
            
            // Aplicar scroll con animación
            mainElement.scrollTo({
              top: newScrollPosition,
              behavior: 'smooth'
            });
          }
        });
        
        // Variables para el arrastre
        let isDragging = false;
        let startDragY = 0;
        let startScrollTop = 0;
        
        // Iniciar arrastre
        scrollbarThumb.addEventListener('mousedown', (e) => {
          isDragging = true;
          startDragY = e.clientY;
          startScrollTop = mainElement.scrollTop;
          
          // Cambiar estilo durante el arrastre
          scrollbarThumb.style.width = '8px';
          scrollbarThumb.style.background = 'rgba(52, 152, 219, 1)';
          scrollbarThumb.style.opacity = '1';
          scrollbarThumb.style.boxShadow = '0 0 8px rgba(52, 152, 219, 0.5)';
          
          // Prevenir selección de texto durante el arrastre
          document.body.style.userSelect = 'none';
          
          // Prevenir comportamiento por defecto
          e.preventDefault();
        });
        
        // Manejar movimiento durante el arrastre
        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          
          const deltaY = e.clientY - startDragY;
          const trackHeight = scrollbarTrack.clientHeight;
          const thumbHeight = parseFloat(scrollbarThumb.style.height);
          
          // Calcular qué porcentaje del scroll representa el movimiento
          const scrollRatio = deltaY / (trackHeight - thumbHeight);
          const scrollAmount = scrollRatio * (mainElement.scrollHeight - mainElement.clientHeight);
          
          // Aplicar el scroll
          mainElement.scrollTop = Math.max(0, Math.min(startScrollTop + scrollAmount, 
                                                      mainElement.scrollHeight - mainElement.clientHeight));
        });
        
        // Finalizar arrastre
        document.addEventListener('mouseup', () => {
          if (isDragging) {
            isDragging = false;
            scrollbarThumb.style.width = '6px';
            scrollbarThumb.style.background = 'rgba(52, 152, 219, 0.5)';
            scrollbarThumb.style.opacity = '0.5';
            scrollbarThumb.style.boxShadow = '0 0 3px rgba(0, 0, 0, 0.2)';
            document.body.style.userSelect = '';
          }
        });
        
        // Manejar redimensionamiento de ventana
        window.addEventListener('resize', updateScrollbarThumb);
        
        // Mostrar/ocultar según sea necesario
        const checkScrollbarVisibility = () => {
          if (mainElement.scrollHeight > mainElement.clientHeight) {
            scrollbarTrack.style.display = 'block';
            updateScrollbarThumb();
          } else {
            scrollbarTrack.style.display = 'none';
          }
        };
        
        // Verificar visibilidad al inicio
        checkScrollbarVisibility();
        
        // Verificar después de cambios de contenido
        const resizeObserver = new ResizeObserver(() => {
          checkScrollbarVisibility();
        });
        
        resizeObserver.observe(mainElement);
        
        // Ocultar la barra cuando no se usa (opcional)
        let hideTimeout;
        
        const showScrollbar = () => {
          scrollbarThumb.style.opacity = '0.5';
          scrollbarTrack.style.opacity = '1';
          
          clearTimeout(hideTimeout);
          hideTimeout = setTimeout(() => {
            if (!isDragging && !scrollbarThumb.matches(':hover')) {
              scrollbarThumb.style.opacity = '0.2';
              scrollbarTrack.style.opacity = '0.5';
            }
          }, 1500);
        };
        
        // Mostrar la barra al mover el ratón o hacer scroll
        mainElement.addEventListener('mousemove', showScrollbar);
        mainElement.addEventListener('scroll', showScrollbar);
        
        // Evento inicial para mostrar la barra
        showScrollbar();
      }
    }, 100);
  });
  
  onDestroy(() => {
    // Limpiar suscripción al desmontar
    unsubscribeTeam();
  });
</script>

<main>
  <TeamSwitcher />
  
  <div class="background-gradient"></div>
  
  <div class="content-wrapper">
    <header>
      <h1>Área de Soporte QA</h1>
      <p>Control inteligente de turnos y horarios - Equipo {currentTeamId + 1}</p>
    </header>
    
    {#if isLoading}
      <div class="loading-overlay">
        <div class="spinner"></div>
        <p>Cambiando de equipo...</p>
      </div>
    {:else}
      <!-- Key reactiva para forzar re-renderizado -->
      {#key currentTeamId}
        <div class="dashboard-grid">
          <div class="grid-item roles-section">
            <RolesManagement />
          </div>
          <div class="grid-item collaborators-section">
            <CollaboratorsManagement />
          </div>
          <div class="grid-item rotation-section">
            <RotationManagement />
          </div>
        </div>
      {/key}
    {/if}
    
    <div class="actions">
      <button on:click={goBack} class="back-button">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="back-icon">
          <path d="M19 12H5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 19L5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Volver al inicio
      </button>
    </div>
  </div>
  
  <div class="copyright">
    <p>Creado por José Ismael Morales Uriarte para Edwards Lifescienses CR</p>
  </div>
</main>

<style>
  /* Reseteo para eliminar márgenes y padding por defecto */
  :global(body), :global(html) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  :global(#app) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  main {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%; /* Usamos 100% ya que nuestra barra personalizada es más delgada */
    height: 100%;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    overflow-x: hidden;
    background: #1a1f35;
    color: white;
    /* Ocultamos la barra de desplazamiento nativa */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
    padding-right: 10px; /* Espacio para la barra personalizada */
  }
  
  /* Ocultar la barra de desplazamiento del navegador pero mantener la funcionalidad */
  main::-webkit-scrollbar {
    width: 0px;
    background: transparent;
  }
  
  /* Fondo con degradado sutil */
  .background-gradient {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at top right, rgba(52, 152, 219, 0.2) 0%, rgba(26, 31, 53, 0) 50%),
                radial-gradient(circle at bottom left, rgba(46, 204, 113, 0.15) 0%, rgba(26, 31, 53, 0) 50%);
    z-index: 0;
  }
  
  /* Contenido */
  .content-wrapper {
    position: relative;
    z-index: 1;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  
  header {
    text-align: center;
    margin-bottom: 2rem;
    padding-top: 1rem;
  }
  
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: white;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }
  
  header p {
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.8);
    max-width: 600px;
    margin: 0 auto;
  }
  
  /* Layout de grid para las secciones */
  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    gap: 1.5rem;
    margin-bottom: 2rem;
    flex: 1;
  }
  
  .grid-item {
    min-height: 350px;
    overflow: hidden;
  }
  
  /* Aseguramos que los componentes ocupen todo el espacio disponible */
  .grid-item :global(.section-container) {
    height: 100%;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }
  
  .grid-item :global(.content) {
    height: calc(100% - 60px); /* Altura total menos la altura del título */
    overflow: auto;
  }
  
  /* Estilos para las barras de desplazamiento (mantenemos estos para las otras barras) */
  :global(::-webkit-scrollbar) {
    width: 10px;
    height: 10px;
  }
  
  :global(::-webkit-scrollbar-track) {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
  }
  
  :global(::-webkit-scrollbar-thumb) {
    background: rgba(52, 152, 219, 0.5);
    border-radius: 10px;
  }
  
  :global(::-webkit-scrollbar-thumb:hover) {
    background: rgba(52, 152, 219, 0.7);
  }
  
  /* Botón de volver */
  .actions {
    text-align: center;
    margin: 1.5rem 0;
  }
  
  .back-button {
    background: linear-gradient(45deg, #3498db, #2980b9);
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    padding: 0.8rem 1.8rem;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.3s;
    box-shadow: 0 4px 15px rgba(52, 152, 219, 0.4);
  }
  
  .back-button:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(52, 152, 219, 0.5);
  }
  
  .back-icon {
    width: 20px;
    height: 20px;
  }
  
  /* Copyright */
  .copyright {
    text-align: center;
    padding: 1rem 0;
    width: 100%;
    z-index: 1;
  }
  
  .copyright p {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.2);
    display: inline-block;
    border-radius: 50px;
    letter-spacing: 0.5px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
  }
  
  .copyright p:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(0, 0, 0, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }
  
  /* Para pantallas medianas y grandes */
  @media (min-width: 768px) {
    .dashboard-grid {
      grid-template-columns: 1fr 1fr;
      grid-template-areas: 
        "roles collaborators"
        "rotation rotation";
    }
    
    .roles-section {
      grid-area: roles;
    }
    
    .collaborators-section {
      grid-area: collaborators;
    }
    
    .rotation-section {
      grid-area: rotation;
    }
  }
  
  /* Para pantallas muy grandes */
  @media (min-width: 1200px) {
    .dashboard-grid {
      grid-template-rows: minmax(400px, auto) minmax(400px, auto);
    }
  }

  /* Añadir estilos para el loading overlay */
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(26, 31, 53, 0.9);
    backdrop-filter: blur(5px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-left-color: #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .loading-overlay p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 1.1rem;
  }
  
  /* Ajustar padding para el TeamSwitcher */
  .content-wrapper {
    padding-top: 100px; /* Espacio para el switcher */
  }
</style>