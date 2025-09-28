<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  function goToSupport() {
     window.location.href = '/gestion-rotaciones/#support';;
  }

  onMount(() => {
    // Forzar reset de estilos globales
    document.body.style.cssText = `
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
    `;
    
    // Reset del contenedor de la app
    const app = document.querySelector('#app');
    if (app) {
      app.style.cssText = `
        width: 100%;
        height: 100%;
        display: block;
        overflow: hidden;
      `;
    }

    // Forzar repaint para animaciones
    setTimeout(() => {
      document.body.style.opacity = '1';
    }, 100);
  });
</script>

<main>
  <div class="background-animation">
    <div class="rotating-circle circle-1"></div>
    <div class="rotating-circle circle-2"></div>
    <div class="rotating-circle circle-3"></div>
    <div class="rotating-circle circle-4"></div>
    <div class="rotating-circle circle-5"></div>
    <div class="rotating-circle circle-6"></div>
  </div>

  <div class="content">
    <div class="logo-container">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
    
    <h1>Gestión de Rotaciones</h1>
    
    <p class="subtitle">Control inteligente de turnos y horarios</p>
    
    <button class="cta-button" on:click={goToSupport}>
      <span>Área de Soporte QA</span>
      <div class="button-animation">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </button>
  </div>
  
  <div class="copyright">
    <p>Creado por José Ismael Morales Uriarte para Edwards Lifescienses CR</p>
  </div>
</main>

<style>
  /* ==================== RESETEO GLOBAL ==================== */
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
    display: block;
    overflow: hidden;
  }
  
  /* ==================== CONTENEDOR PRINCIPAL ==================== */
  main {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: linear-gradient(135deg, #1a1f35 0%, #0f2c3e 100%);
    color: white;
  }
  
  /* ==================== ANIMACIÓN DE FONDO ==================== */
  .background-animation {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 0;
  }
  
  .rotating-circle {
    position: absolute;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.1);
    opacity: 0.5;
    pointer-events: none;
  }
  
  .circle-1 {
    width: 400px;
    height: 400px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-color: rgba(52, 152, 219, 0.2);
    animation: rotate 30s linear infinite;
  }
  
  .circle-2 {
    width: 300px;
    height: 300px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-color: rgba(231, 76, 60, 0.2);
    animation: rotate 25s linear infinite reverse;
  }
  
  .circle-3 {
    width: 200px;
    height: 200px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-color: rgba(46, 204, 113, 0.2);
    animation: rotate 20s linear infinite;
  }
  
  .circle-4 {
    width: 600px;
    height: 600px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-color: rgba(155, 89, 182, 0.1);
    animation: rotate 45s linear infinite reverse;
  }
  
  .circle-5 {
    width: 800px;
    height: 800px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-color: rgba(241, 196, 15, 0.1);
    animation: rotate 60s linear infinite;
  }
  
  .circle-6 {
    width: 100px;
    height: 100px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-color: rgba(52, 152, 219, 0.3);
    animation: rotate 15s linear infinite reverse;
  }
  
  @keyframes rotate {
    0% {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    100% {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
  
  /* Puntos en movimiento para representar 'personas' en rotación */
  .circle-1::before,
  .circle-2::before,
  .circle-3::before,
  .circle-4::before,
  .circle-5::before,
  .circle-6::before {
    content: "";
    position: absolute;
    width: 10px;
    height: 10px;
    background-color: #fff;
    border-radius: 50%;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.5);
  }
  
  /* ==================== CONTENIDO CENTRAL ==================== */
  .content {
    z-index: 1;
    text-align: center;
    padding: 1.8rem;
    backdrop-filter: blur(10px);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    
    /* ✅ TAMAÑO MÁS PEQUEÑO */
    width: 420px;
    max-width: 85vw;
    min-width: 300px;
    
    /* ✅ FORZAR POSICIÓN CENTRADA */
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    
    /* ✅ RESETEAR CUALQUIER ESTILO HEREDADO */
    margin: 0 !important;
    height: auto !important;
    flex: none !important;
  }
  
  .logo-container {
    margin-bottom: 1rem;
  }
  
  .logo {
    width: 70px;
    height: 70px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    margin: 0 auto;
    animation: pulse 3s infinite alternate;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    100% {
      transform: scale(1.05);
      box-shadow: 0 4px 30px rgba(52, 152, 219, 0.4);
    }
  }
  
  .logo svg {
    width: 42px;
    height: 42px;
  }
  
  h1 {
    font-size: 3rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    background: linear-gradient(45deg, #ffffff, #e0e0e0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -1px;
    text-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }
  
  .subtitle {
    font-size: 1.2rem;
    margin-bottom: 2rem;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 300;
  }
  
  .cta-button {
    background: linear-gradient(45deg, #3498db, #2980b9);
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    padding: 0.9rem 2.2rem 0.9rem 2.7rem;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    transition: all 0.4s;
    box-shadow: 0 8px 20px rgba(52, 152, 219, 0.5);
    position: relative;
    overflow: hidden;
    margin: 0 auto;
  }
  
  .cta-button:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 30px rgba(52, 152, 219, 0.7);
    background: linear-gradient(45deg, #2980b9, #3498db);
  }
  
  .button-animation {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.4s;
  }
  
  .cta-button:hover .button-animation {
    transform: translateX(3px);
  }
  
  /* ==================== COPYRIGHT ==================== */
  .copyright {
    position: absolute;
    bottom: 1.5rem;
    text-align: center;
    width: 100%;
    z-index: 1;
  }
  
  .copyright p {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    padding: 0.5rem 1rem;
    backdrop-filter: blur(5px);
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
  
  /* ==================== RESPONSIVE ==================== */
  @media (max-width: 768px) {
    .content {
      width: 85vw;
      max-width: 350px;
      padding: 1.8rem 1.4rem;
    }
    
    h1 {
      font-size: 2.3rem;
    }
    
    .subtitle {
      font-size: 1rem;
    }
    
    .copyright p {
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
    }
  }
  
  @media (max-width: 480px) {
    .content {
      width: 90vw;
      max-width: 320px;
      padding: 1.5rem 1rem;
    }
    
    h1 {
      font-size: 1.9rem;
    }
    
    .subtitle {
      font-size: 0.95rem;
      margin-bottom: 2rem;
    }
    
    .cta-button {
      font-size: 1rem;
      padding: 0.8rem 1.8rem 0.8rem 2.2rem;
    }
    
    .logo {
      width: 55px;
      height: 55px;
    }
    
    .logo svg {
      width: 32px;
      height: 32px;
    }
  }
</style>