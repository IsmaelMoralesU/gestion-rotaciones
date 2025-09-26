<!-- src/lib/components/TeamSwitcher.svelte -->
<script context="module">
  import { writable } from 'svelte/store';
  
  // Exportar el store desde el context module para que sea accesible desde otros componentes
  export const activeTeam = writable(0);
</script>

<script>
  import { onMount } from 'svelte';
  
  // Configuración de equipos
  const teams = [
    { id: 0, name: 'Equipo 1', icon: '1️⃣', color: '#3498db' },
    { id: 1, name: 'Equipo 2', icon: '2️⃣', color: '#e74c3c' },
    { id: 2, name: 'Equipo 3', icon: '3️⃣', color: '#2ecc71' }
  ];
  
  let currentTeam = 0;
  
  // Suscribirse a cambios
  activeTeam.subscribe(value => {
    currentTeam = value;
  });
  
  // Cambiar equipo
  function switchTeam(teamId) {
    activeTeam.set(teamId);
    // Guardar en localStorage para persistencia
    localStorage.setItem('gestionRotaciones_activeTeam', teamId.toString());
  }
  
  // Atajos de teclado
  function handleKeydown(event) {
    // Ctrl/Cmd + número para cambiar de equipo
    if ((event.ctrlKey || event.metaKey) && event.key >= '1' && event.key <= '3') {
      event.preventDefault();
      const teamIndex = parseInt(event.key) - 1;
      if (teamIndex < teams.length) {
        switchTeam(teamIndex);
      }
    }
    
    // Ctrl/Cmd + Tab para siguiente equipo
    if ((event.ctrlKey || event.metaKey) && event.key === 'Tab') {
      event.preventDefault();
      const nextTeam = (currentTeam + 1) % teams.length;
      switchTeam(nextTeam);
    }
  }
  
  onMount(() => {
    // Restaurar equipo activo
    const saved = localStorage.getItem('gestionRotaciones_activeTeam');
    if (saved) {
      activeTeam.set(parseInt(saved));
    }
    
    // Agregar listener de teclado
    window.addEventListener('keydown', handleKeydown);
    
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="team-switcher">
  <div class="team-tabs">
    {#each teams as team}
      <button
        class="team-tab {currentTeam === team.id ? 'active' : ''}"
        on:click={() => switchTeam(team.id)}
        style="--team-color: {team.color}"
        title="{team.name} (Ctrl+{team.id + 1})"
      >
        <span class="team-icon">{team.icon}</span>
        <span class="team-name">{team.name}</span>
        {#if currentTeam === team.id}
          <span class="active-indicator"></span>
        {/if}
      </button>
    {/each}
  </div>
  
  <div class="team-info">
    <span class="current-team">Trabajando en: {teams[currentTeam].name}</span>
    <span class="shortcut-hint">Ctrl+Tab para cambiar</span>
  </div>
</div>

<style>
  .team-switcher {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    background: rgba(26, 31, 53, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .team-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .team-tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  
  .team-tab::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--team-color);
    transform: scaleX(0);
    transition: transform 0.3s;
  }
  
  .team-tab:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  .team-tab.active {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--team-color);
    color: white;
    box-shadow: 0 0 20px rgba(var(--team-color), 0.3);
  }
  
  .team-tab.active::before {
    transform: scaleX(1);
  }
  
  .team-icon {
    font-size: 1.1rem;
  }
  
  .team-name {
    font-weight: 500;
  }
  
  .active-indicator {
    position: absolute;
    bottom: -0.5rem;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    background: var(--team-color);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--team-color);
  }
  
  .team-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .current-team {
    color: rgba(255, 255, 255, 0.7);
  }
  
  .shortcut-hint {
    font-style: italic;
  }
  
  /* Versión compacta para móviles */
  @media (max-width: 768px) {
    .team-switcher {
      top: 10px;
      right: 10px;
      padding: 0.3rem;
    }
    
    .team-tab {
      padding: 0.5rem 0.8rem;
    }
    
    .team-name {
      display: none;
    }
    
    .team-info {
      display: none;
    }
  }
  
  /* Animación de entrada */
  .team-switcher {
    animation: slideIn 0.3s ease-out;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  /* Efecto de pulso para el equipo activo */
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(var(--team-color), 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(var(--team-color), 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(var(--team-color), 0);
    }
  }
  
  .team-tab.active {
    animation: pulse 2s infinite;
  }
</style>