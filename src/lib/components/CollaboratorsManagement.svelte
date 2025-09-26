<script>
  import '../../lib/styles/management.css';
  import { onMount, onDestroy } from 'svelte';
  import { db } from '../../lib/services/DatabaseService.js';
  import '../../lib/styles/collaborators.css'; // Importar estilos específicos

  
  // Estado para el formulario
  let collaboratorName = "";
  let collaborators = [];
  let editingIndex = -1;
  let formError = "";
  
  // Estado para certificaciones
  let availableCertifications = [];
  let selectedCertifications = [];
  let mounted = false;
  
  // Estado para días inhabilitados
  let unavailableDays = {
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false
  };
  
  // Modal para editar días inhabilitados
  let showDaysModal = false;
  let editingDaysForIndex = -1;
  let tempUnavailableDays = { ...unavailableDays };
  
  // **NUEVO: Modal de estadísticas**
  let showStatsModal = false;
  let selectedCollaboratorForStats = null;
  let collaboratorStats = {
    rotations: [],
    totalAssignments: 0,
    rolesFrequency: {},
    monthlyBreakdown: {}
  };
  
  // ==================== **VARIABLES PARA EL CARRUSEL** ====================
  
  // Estado para el carrusel de rotaciones
  let currentRotationIndex = 0;
  
  // Traducción de días
  const dayTranslations = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes'
  };
  
  // Variables para cleanup de suscripciones
  let unsubscribeRoles = null;
  let unsubscribeCollabs = null;
  let unsubscribeRotations = null; // Para escuchar cambios en rotaciones**
  
  // ==================== INICIALIZACIÓN Y CARGA DE DATOS ====================
  
  onMount(async () => {
    try {
      console.log('🚀 Inicializando CollaboratorsManagement...');
      
      // 1. Inicializar servicio unificado
      await db.init();
      console.log('✅ Servicio de base de datos inicializado');
      
      // 2. Cargar todos los datos
      await loadAllData();
      
      // 3. Suscribirse a cambios automáticos
      unsubscribeRoles = db.subscribe('roles', handleRoleChanges);
      unsubscribeCollabs = db.subscribe('collaborators', handleCollaboratorChanges);
      unsubscribeRotations = db.subscribe('rotations', handleRotationChanges); // **NUEVO**
      
      console.log('✅ Suscripciones configuradas');
      
      // 4. Marcar como montado
      mounted = true;
      console.log('✅ CollaboratorsManagement inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando CollaboratorsManagement:', error);
      // Fallback completo a localStorage
      await loadFromLocalStorageFallback();
      mounted = true;
    }
  });
  
  // Cleanup al desmontar
  onDestroy(() => {
    if (unsubscribeRoles) unsubscribeRoles();
    if (unsubscribeCollabs) unsubscribeCollabs();
    if (unsubscribeRotations) unsubscribeRotations(); // ****
    
    // ✅ LIMPIAR LISTENER DE TECLADO AL DESMONTAR
    document.removeEventListener('keydown', handleCarouselKeyboard);
  });
  
  // ==================== FUNCIONES DE CARGA DE DATOS ====================
  
  async function loadAllData() {
    try {
      // Cargar colaboradores desde el servicio
      const loadedCollaborators = await db.getAll('collaborators');
      collaborators = loadedCollaborators.map(normalizeCollaborator);
      console.log(`✅ ${collaborators.length} colaboradores cargados`);
      
      // Cargar certificaciones (roles) desde el servicio
      await loadCertificationsFromService();
      
    } catch (error) {
      console.error('❌ Error cargando datos desde servicio:', error);
      // Fallback automático
      await loadFromLocalStorageFallback();
    }
  }
  
  async function loadCertificationsFromService() {
    try {
      const loadedRoles = await db.getAll('roles');
      availableCertifications = loadedRoles.map(role => role.name);
      console.log(`✅ ${availableCertifications.length} certificaciones cargadas`);
    } catch (error) {
      console.error('❌ Error cargando certificaciones:', error);
      loadCertificationsFromLocalStorage();
    }
  }
  
  // Función de respaldo para cargar desde localStorage
  async function loadFromLocalStorageFallback() {
    console.log('📁 Usando fallback a localStorage...');
    
    try {
      // Cargar colaboradores
      const savedCollaborators = localStorage.getItem('gestionRotaciones_collaborators');
      if (savedCollaborators) {
        const parsed = JSON.parse(savedCollaborators);
        collaborators = parsed.map(normalizeCollaborator);
        console.log(`📁 ${collaborators.length} colaboradores cargados desde localStorage`);
      }
      
      // Cargar certificaciones
      loadCertificationsFromLocalStorage();
      
    } catch (error) {
      console.error('❌ Error en fallback localStorage:', error);
      collaborators = [];
      availableCertifications = [];
    }
  }
  
  function loadCertificationsFromLocalStorage() {
    try {
      const savedRoles = localStorage.getItem('gestionRotaciones_roles');
      
      if (savedRoles) {
        const roles = JSON.parse(savedRoles);
        
        if (Array.isArray(roles) && roles.length > 0) {
          availableCertifications = roles.map(role => {
            return role && typeof role === 'object' && role.name ? role.name : String(role);
          });
        } else {
          availableCertifications = [];
        }
      } else {
        availableCertifications = [];
      }
      
      console.log(`📁 ${availableCertifications.length} certificaciones cargadas desde localStorage`);
    } catch (error) {
      console.error('❌ Error cargando certificaciones desde localStorage:', error);
      availableCertifications = [];
    }
  }
  
  // ==================== FUNCIONES DE GUARDADO ====================
  
  async function saveCollaborators() {
    if (!mounted) return; // Evitar guardar antes de cargar
    
    try {
      // Guardar usando el servicio unificado
      await db.saveAll('collaborators', collaborators);
      console.log('✅ Colaboradores guardados correctamente');
    } catch (error) {
      console.error('❌ Error guardando colaboradores:', error);
      // Fallback a localStorage
      saveCollaboratorsToLocalStorage();
    }
  }
  
  function saveCollaboratorsToLocalStorage() {
    try {
      localStorage.setItem('gestionRotaciones_collaborators', JSON.stringify(collaborators));
      console.log('💾 Colaboradores guardados en localStorage (fallback)');
    } catch (error) {
      console.error('❌ Error guardando en localStorage:', error);
    }
  }
  
  // ==================== REACTIVIDAD DE SVELTE ====================
  
  // Observar cambios en colaboradores para guardar automáticamente
  $: if (mounted && collaborators) {
    saveCollaborators();
  }
  
  // ==================== **REACTIVIDAD DEL CARRUSEL** ====================
  
  // Reactive statement para validar el índice del carrusel
  $: if (currentRotationIndex >= collaboratorStats.rotations.length && collaboratorStats.rotations.length > 0) {
    currentRotationIndex = collaboratorStats.rotations.length - 1;
  }
  
  // Reactive statement para logging (opcional)
  $: if (showStatsModal && collaboratorStats.rotations.length > 0) {
    console.log(`📊 Mostrando rotación ${currentRotationIndex + 1} de ${collaboratorStats.rotations.length}`);
  }
  
  // ==================== HANDLERS DE SINCRONIZACIÓN ====================
  
  function handleRoleChanges(event) {
    // Actualizar certificaciones cuando cambien los roles en RolesManagement
    if (event.action === 'save' || event.action === 'saveAll') {
      console.log('🔄 Roles actualizados, recargando certificaciones...');
      loadCertificationsFromService();
    }
    
    // NUEVO: Detectar cambios de nombre en roles
    if (event.action === 'rename' && event.data && event.data.oldName && event.data.newName) {
      console.log(`🔄 Rol renombrado de "${event.data.oldName}" a "${event.data.newName}"`);
      updateCollaboratorCertifications(event.data.oldName, event.data.newName);
    }
    
    // NUEVO: Detectar eliminación de roles
    if (event.action === 'delete' && event.data && event.data.roleName) {
      console.log(`🔄 Rol eliminado: "${event.data.roleName}"`);
      removeDeletedCertification(event.data.roleName);
    }
  }
  
  function handleCollaboratorChanges(event) {
    // Manejar cambios externos en colaboradores (si otro componente los modifica)
    if (event.action === 'saveAll' && event.data && mounted) {
      console.log('🔄 Colaboradores actualizados externamente');
      // Aquí podrías decidir si recargar los datos o no
    }
  }
  
  // **  Handler para cambios en rotaciones**
  function handleRotationChanges(event) {
    // Si hay una rotación abierta y se actualiza, refrescar las estadísticas
    if (showStatsModal && selectedCollaboratorForStats) {
      console.log('🔄 Rotaciones actualizadas, recargando estadísticas...');
      loadCollaboratorStats(selectedCollaboratorForStats);
    }
  }
  
  // ==================== NUEVAS FUNCIONES PARA SINCRONIZACIÓN DE CERTIFICACIONES ====================
  
  // NUEVA FUNCIÓN: Actualizar certificaciones cuando se renombra un rol
  async function updateCollaboratorCertifications(oldRoleName, newRoleName) {
    try {
      console.log(`🔄 Actualizando certificaciones: ${oldRoleName} → ${newRoleName}`);
      
      let updated = false;
      let updatedCount = 0;
      
      // Actualizar cada colaborador que tenga la certificación antigua
      const updatedCollaborators = collaborators.map(collaborator => {
        if (collaborator.certifications && collaborator.certifications.includes(oldRoleName)) {
          // Reemplazar la certificación antigua con la nueva
          const updatedCertifications = collaborator.certifications.map(cert => 
            cert === oldRoleName ? newRoleName : cert
          );
          
          updated = true;
          updatedCount++;
          console.log(`✅ Actualizada certificación para ${collaborator.name}`);
          
          return {
            ...collaborator,
            certifications: updatedCertifications
          };
        }
        return collaborator;
      });
      
      if (updated) {
        collaborators = updatedCollaborators;
        // Guardar los cambios
        await saveCollaborators();
        showStatusMessage(`Certificaciones actualizadas: ${oldRoleName} → ${newRoleName} (${updatedCount} colaboradores)`, true);
      }
      
    } catch (error) {
      console.error('❌ Error actualizando certificaciones:', error);
      showStatusMessage('Error al actualizar certificaciones', false);
    }
  }
  
  // NUEVA FUNCIÓN: Eliminar certificación cuando se elimina un rol
  async function removeDeletedCertification(deletedRoleName) {
    try {
      console.log(`🔄 Eliminando certificación: ${deletedRoleName}`);
      
      let updated = false;
      let updatedCount = 0;
      
      // Eliminar la certificación de cada colaborador que la tenga
      const updatedCollaborators = collaborators.map(collaborator => {
        if (collaborator.certifications && collaborator.certifications.includes(deletedRoleName)) {
          // Filtrar la certificación eliminada
          const updatedCertifications = collaborator.certifications.filter(cert => 
            cert !== deletedRoleName
          );
          
          updated = true;
          updatedCount++;
          console.log(`✅ Eliminada certificación "${deletedRoleName}" de ${collaborator.name}`);
          
          return {
            ...collaborator,
            certifications: updatedCertifications
          };
        }
        return collaborator;
      });
      
      if (updated) {
        collaborators = updatedCollaborators;
        // Guardar los cambios
        await saveCollaborators();
        showStatusMessage(`Certificación "${deletedRoleName}" eliminada de ${updatedCount} colaboradores`, true);
      }
      
    } catch (error) {
      console.error('❌ Error eliminando certificación:', error);
      showStatusMessage('Error al eliminar certificación', false);
    }
  }
  
  // NUEVA FUNCIÓN: Mostrar mensaje de estado
  let statusMessage = "";
  let statusMessageType = "success";
  let showStatusMessageFlag = false;
  let statusMessageTimeout = null;
  
  function showStatusMessage(message, isSuccess = true) {
    statusMessage = message;
    statusMessageType = isSuccess ? "success" : "error";
    showStatusMessageFlag = true;
    
    // Limpiar timeout anterior si existe
    if (statusMessageTimeout) {
      clearTimeout(statusMessageTimeout);
    }
    
    // Ocultar el mensaje después de 5 segundos
    statusMessageTimeout = setTimeout(() => {
      showStatusMessageFlag = false;
    }, 5000);
  }
  
  // ==================== NORMALIZACIÓN DE DATOS ====================
  
  function normalizeCollaborator(collab) {
    return {
      ...collab,
      certifications: Array.isArray(collab.certifications) ? collab.certifications : 
                    (collab.certifications ? [collab.certifications] : []),
      unavailableDays: collab.unavailableDays || { ...unavailableDays }
    };
  }
  
  // ==================== VALIDACIONES ====================
  
  function validateCollaboratorName(name) {
    const trimmedName = name.trim();
    
    if (trimmedName.length < 3) {
      return "El nombre debe tener al menos 3 caracteres";
    }
    
    return null;
  }
  
  // ==================== LÓGICA DE FORMULARIO ====================
  
  function handleSubmit() {
    formError = "";
    
    // Validar nombre
    const nameError = validateCollaboratorName(collaboratorName);
    if (nameError) {
      formError = nameError;
      return;
    }
    
    // Limpiar nombre
    const cleanedName = collaboratorName.trim();
    
    // Verificar duplicados
    const duplicateName = collaborators.find((collab, index) => 
      collab.name.toLowerCase() === cleanedName.toLowerCase() && 
      index !== editingIndex
    );
    
    if (duplicateName) {
      formError = "Ya existe un colaborador con este nombre";
      return;
    }
    
    // Crear el objeto colaborador
    let collaborator = {
      name: cleanedName,
      certifications: [...selectedCertifications],
      unavailableDays: { ...unavailableDays }
    };
    
    if (editingIndex === -1) {
      // Agregar nuevo colaborador
      collaborators = [...collaborators, collaborator];
      showStatusMessage(`Colaborador "${cleanedName}" agregado exitosamente`, true);
    } else {
      // Actualizar colaborador existente
      const updatedCollaborators = [...collaborators];
      const existingCollaborator = updatedCollaborators[editingIndex];
      
      // Mantener los días inhabilitados existentes
      collaborator.unavailableDays = existingCollaborator.unavailableDays || { ...unavailableDays };
      
      updatedCollaborators[editingIndex] = collaborator;
      collaborators = updatedCollaborators;
      editingIndex = -1;
      showStatusMessage(`Colaborador "${cleanedName}" actualizado exitosamente`, true);
    }
    
    // Limpiar el formulario
    resetForm();
  }
  
  function resetForm() {
    collaboratorName = "";
    selectedCertifications = [];
  }
  
  function editCollaborator(index) {
    const collaborator = collaborators[index];
    collaboratorName = collaborator.name;
    
    // Asegurarnos de que certifications sea un array
    selectedCertifications = Array.isArray(collaborator.certifications) 
      ? [...collaborator.certifications] 
      : [];
      
    editingIndex = index;
  }
  
  function deleteCollaborator(index) {
    const deletedName = collaborators[index].name;
    collaborators = collaborators.filter((_, i) => i !== index);
    
    if (editingIndex === index) {
      resetForm();
      editingIndex = -1;
    }
    
    showStatusMessage(`Colaborador "${deletedName}" eliminado`, true);
  }
  
  // ==================== LÓGICA DE CERTIFICACIONES ====================
  
  // Toggle de selección para certificaciones
  function toggleCertification(cert) {
    if (selectedCertifications.includes(cert)) {
      selectedCertifications = selectedCertifications.filter(c => c !== cert);
    } else {
      selectedCertifications = [...selectedCertifications, cert];
    }
  }

  // ==================== NUEVAS FUNCIONES PARA SELECCIÓN MASIVA ====================
  
  // Seleccionar todas las certificaciones disponibles
  function selectAllCertifications() {
    selectedCertifications = [...availableCertifications];
    console.log(`✅ ${selectedCertifications.length} certificaciones seleccionadas`);
  }
  
  // Deseleccionar todas las certificaciones
  function clearAllCertifications() {
    selectedCertifications = [];
    console.log('❌ Todas las certificaciones deseleccionadas');
  }
  
  // Función de conveniencia para verificar si todas están seleccionadas
  function areAllCertificationsSelected() {
    return availableCertifications.length > 0 && 
           selectedCertifications.length === availableCertifications.length;
  }
  
  // Función de conveniencia para verificar si hay alguna seleccionada
  function hasSelectedCertifications() {
    return selectedCertifications.length > 0;
  }
  
  // ==================== LÓGICA DE MODAL DE DÍAS ====================
  
  function openDaysModal(index) {
    const collaborator = collaborators[index];
    // Copiar los días inhabilitados actuales al estado temporal
    tempUnavailableDays = { ...(collaborator.unavailableDays || unavailableDays) };
    editingDaysForIndex = index;
    showDaysModal = true;
  }
  
  function closeDaysModal() {
    showDaysModal = false;
    editingDaysForIndex = -1;
    // Reiniciar estado temporal
    tempUnavailableDays = { ...unavailableDays };
  }
  
  function toggleDayAvailability(day) {
    tempUnavailableDays = {
      ...tempUnavailableDays,
      [day]: !tempUnavailableDays[day]
    };
  }
  
  function saveDaysChanges() {
    if (editingDaysForIndex >= 0 && editingDaysForIndex < collaborators.length) {
      // Crear copia de collaborators para mantener la reactividad
      const updatedCollaborators = [...collaborators];
      // Actualizar los días inhabilitados
      updatedCollaborators[editingDaysForIndex].unavailableDays = { ...tempUnavailableDays };
      // Actualizar la lista de collaborators
      collaborators = updatedCollaborators;
      // Cerrar el modal
      closeDaysModal();
      showStatusMessage(`Disponibilidad actualizada para ${collaborators[editingDaysForIndex].name}`, true);
    }
  }
  
  // Seleccionar/deseleccionar todos los días
  function selectAllDays(select = true) {
    const updatedDays = {};
    Object.keys(tempUnavailableDays).forEach(day => {
      updatedDays[day] = select;
    });
    tempUnavailableDays = updatedDays;
  }
  
  // ==================== ** FUNCIONES DEL CARRUSEL** ====================
  
  // Navegar en el carrusel
  function navigateCarousel(direction) {
    if (direction === 'next' && currentRotationIndex < collaboratorStats.rotations.length - 1) {
      currentRotationIndex++;
    } else if (direction === 'prev' && currentRotationIndex > 0) {
      currentRotationIndex--;
    }
    
    console.log(`🎠 Navegando a rotación ${currentRotationIndex + 1} de ${collaboratorStats.rotations.length}`);
  }
  
  // Ir directamente a una rotación específica
  function goToRotation(index) {
    if (index >= 0 && index < collaboratorStats.rotations.length) {
      currentRotationIndex = index;
      console.log(`🎯 Saltando a rotación ${index + 1}`);
    }
  }
  
  // Navegación con teclado (opcional)
  function handleCarouselKeyboard(event) {
    if (!showStatsModal || collaboratorStats.rotations.length <= 1) return;
    
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        navigateCarousel('prev');
        break;
      case 'ArrowRight':
        event.preventDefault();
        navigateCarousel('next');
        break;
      case 'Home':
        event.preventDefault();
        goToRotation(0);
        break;
      case 'End':
        event.preventDefault();
        goToRotation(collaboratorStats.rotations.length - 1);
        break;
    }
  }
  
  // ==================== **FUNCIONES AUXILIARES DEL CARRUSEL** ====================
  
  // Obtener la rotación actualmente visible
  function getCurrentRotation() {
    if (collaboratorStats.rotations.length === 0) return null;
    return collaboratorStats.rotations[currentRotationIndex] || null;
  }
  
  // Verificar si hay rotaciones anteriores
  function hasPreviousRotation() {
    return currentRotationIndex > 0;
  }
  
  // Verificar si hay rotaciones siguientes
  function hasNextRotation() {
    return currentRotationIndex < collaboratorStats.rotations.length - 1;
  }
  
  // ==================== ** LÓGICA DE ESTADÍSTICAS MODIFICADA** ====================
  
  // Abrir modal de estadísticas (MODIFICADO)
  async function openStatsModal(collaborator) {
    selectedCollaboratorForStats = collaborator;
    showStatsModal = true;
    currentRotationIndex = 0; // ✅ RESETEAR ÍNDICE AL ABRIR
    
    // Cargar estadísticas del colaborador
    await loadCollaboratorStats(collaborator);
    
    // ✅ AGREGAR LISTENER PARA NAVEGACIÓN CON TECLADO
    document.addEventListener('keydown', handleCarouselKeyboard);
  }
  
  // Cerrar modal de estadísticas (MODIFICADO)
  function closeStatsModal() {
    showStatsModal = false;
    selectedCollaboratorForStats = null;
    currentRotationIndex = 0; // ✅ RESETEAR ÍNDICE AL CERRAR
    collaboratorStats = {
      rotations: [],
      totalAssignments: 0,
      rolesFrequency: {},
      monthlyBreakdown: {}
    };
    
    // ✅ REMOVER LISTENER DE TECLADO
    document.removeEventListener('keydown', handleCarouselKeyboard);
  }
  
  // Cargar estadísticas del colaborador
  async function loadCollaboratorStats(collaborator) {
    try {
      // Obtener todas las rotaciones desde la base de datos
      const allRotations = await db.getAll('rotations');
      
      const stats = {
        rotations: [],
        totalAssignments: 0,
        rolesFrequency: {},
        monthlyBreakdown: {}
      };
      
      // Procesar cada rotación
      allRotations.forEach(rotation => {
        const rotationData = processRotationForCollaborator(rotation, collaborator.name);
        
        if (rotationData.totalAssignments > 0) {
          stats.rotations.push(rotationData);
          stats.totalAssignments += rotationData.totalAssignments;
          
          // Acumular frecuencia de roles
          Object.entries(rotationData.rolesFrequency).forEach(([role, count]) => {
            stats.rolesFrequency[role] = (stats.rolesFrequency[role] || 0) + count;
          });
          
          // Crear clave del mes
          const monthKey = `${rotation.year}-${rotation.month.toString().padStart(2, '0')}`;
          stats.monthlyBreakdown[monthKey] = rotationData.totalAssignments;
        }
      });
      
      // Ordenar rotaciones por fecha (más reciente primero)
      stats.rotations.sort((a, b) => {
        const dateA = new Date(a.year, a.month - 1);
        const dateB = new Date(b.year, b.month - 1);
        return dateB - dateA;
      });
      
      collaboratorStats = stats;
      
      console.log(`📊 Estadísticas cargadas para ${collaborator.name}:`, stats);
      
    } catch (error) {
      console.error('❌ Error cargando estadísticas:', error);
      
      // Fallback: intentar cargar desde localStorage
      const savedRotation = localStorage.getItem('gestionRotaciones_currentRotation');
      if (savedRotation) {
        try {
          const rotation = JSON.parse(savedRotation);
          const rotationData = processRotationForCollaborator(rotation, collaborator.name);
          
          if (rotationData.totalAssignments > 0) {
            collaboratorStats = {
              rotations: [rotationData],
              totalAssignments: rotationData.totalAssignments,
              rolesFrequency: rotationData.rolesFrequency,
              monthlyBreakdown: {
                [`${rotation.year}-${rotation.month.toString().padStart(2, '0')}`]: rotationData.totalAssignments
              }
            };
          }
        } catch (parseError) {
          console.error('❌ Error procesando rotación de localStorage:', parseError);
        }
      }
    }
  }
  
  // Procesar una rotación específica para un colaborador
  function processRotationForCollaborator(rotation, collaboratorName) {
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    
    const rotationData = {
      year: rotation.year,
      month: rotation.month,
      monthName: new Date(rotation.year, rotation.month - 1).toLocaleString('es-ES', { month: 'long' }),
      assignments: {},
      totalAssignments: 0,
      rolesFrequency: {},
      daysWorked: 0
    };
    
    // Inicializar asignaciones por día
    weekdays.forEach((dayId, index) => {
      rotationData.assignments[dayId] = {
        dayName: dayNames[index],
        roles: []
      };
    });
    
    // Procesar asignaciones
    if (rotation.assignments) {
      weekdays.forEach(dayId => {
        const dayAssignments = rotation.assignments[dayId] || {};
        let dayHasAssignments = false;
        
        Object.entries(dayAssignments).forEach(([roleName, assignedCollabs]) => {
          if (Array.isArray(assignedCollabs) && assignedCollabs.includes(collaboratorName)) {
            rotationData.assignments[dayId].roles.push(roleName);
            rotationData.totalAssignments++;
            rotationData.rolesFrequency[roleName] = (rotationData.rolesFrequency[roleName] || 0) + 1;
            dayHasAssignments = true;
          }
        });
        
        if (dayHasAssignments) {
          rotationData.daysWorked++;
        }
      });
    }
    
    return rotationData;
  }
  
  // Formatear mes para mostrar
  function formatMonth(year, month) {
    const date = new Date(year, month - 1);
    return `${date.toLocaleString('es-ES', { month: 'long' })} ${year}`;
  }
  
  // ==================== FUNCIONES AUXILIARES ====================
  
  // Función para formatear días inhabilitados para mostrar
  function formatUnavailableDays(daysObj) {
    if (!daysObj) return "Disponible todos los días";
    
    const unavailable = Object.entries(daysObj)
      .filter(([_, value]) => value)
      .map(([day, _]) => dayTranslations[day]);
    
    return unavailable.length > 0 
      ? `No disponible: ${unavailable.join(', ')}` 
      : "Disponible todos los días";
  }
  
  // Verificar si un colaborador tiene días inhabilitados
  function hasUnavailableDays(collaborator) {
    if (!collaborator.unavailableDays) return false;
    return Object.values(collaborator.unavailableDays).some(value => value);
  }
  
  // ==================== FUNCIONES DE MONITOREO (OPCIONALES) ====================
  
  // Función para obtener estadísticas (opcional)
  async function getStats() {
    try {
      const stats = await db.stats();
      console.log('📊 Estadísticas de base de datos:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }
  
  // Función para verificar sincronización (opcional)
  async function checkSync() {
    try {
      const dbCollaborators = await db.getAll('collaborators');
      const isInSync = dbCollaborators.length === collaborators.length;
      console.log('🔄 Estado de sincronización:', isInSync ? 'OK' : 'Desincronizado');
      return isInSync;
    } catch (error) {
      console.error('❌ Error verificando sincronización:', error);
      return false;
    }
  }
</script>

<section class="section-container collaborators-section">
  <h2>Gestión de Colaboradores</h2>
  
  <div class="content">
    <!-- Formulario para agregar/editar colaboradores -->
    <form on:submit|preventDefault={handleSubmit} class="collaborator-form">
      <div class="form-group">
        <label for="collaboratorName">Nombre del Colaborador:</label>
        <input 
          id="collaboratorName" 
          type="text" 
          bind:value={collaboratorName} 
          placeholder="Nombre del Colaborador"
          required
        />
      </div>
      
      {#if formError}
        <div class="error-message">{formError}</div>
      {/if}
      
      <div class="form-actions">
        <button type="submit" class="action-button collaborators-button">
          {editingIndex === -1 ? 'Agregar Colaborador' : 'Actualizar Colaborador'}
        </button>
        
        {#if editingIndex !== -1}
          <button 
            type="button" 
            class="cancel-button" 
            on:click={() => {
              resetForm();
              editingIndex = -1;
            }}
          >
            Cancelar
          </button>
        {/if}
      </div>
    </form>
    
    <!-- Lista de colaboradores -->
    {#if collaborators.length > 0}
      <div class="collaborators-header">
        <h3>Colaboradores Registrados</h3>
      </div>
      
      <div class="collaborators-list">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Certificaciones</th>
                <th>Disponibilidad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each collaborators as collaborator, i}
                <tr class={hasUnavailableDays(collaborator) ? 'partially-unavailable-row' : ''}>
                  <td>
                    <div class="collaborator-name-cell">
                      {collaborator.name}
                    </div>
                  </td>
                  <td>
                    <div class="certifications-cell-simple">
                      <span class="certifications-count-simple" 
                            title={collaborator.certifications?.length > 0 ? collaborator.certifications.join(', ') : 'Sin certificaciones'}>
                        {collaborator.certifications?.length || 0} certificaciones
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class="availability-cell">
                      {#if hasUnavailableDays(collaborator)}
                        <span class="availability-status limited" 
                              title={formatUnavailableDays(collaborator.unavailableDays)}>
                          Disponibilidad limitada
                        </span>
                      {:else}
                        <span class="availability-status full">
                          Disponible todos los días
                        </span>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <div class="action-buttons">
                      <button 
                        class="icon-button edit" 
                        on:click={() => editCollaborator(i)} 
                        title="Editar colaborador"
                      >
                        ✏️
                      </button>
                      <button 
                        class="icon-button calendar" 
                        on:click={() => openDaysModal(i)}
                        title="Configurar disponibilidad"
                      >
                        📅
                      </button>
                      <button 
                        class="icon-button stats" 
                        on:click={() => openStatsModal(collaborator)}
                        title="Ver estadísticas"
                      >
                        📊
                      </button>
                      <button 
                        class="icon-button delete" 
                        on:click={() => deleteCollaborator(i)}
                        title="Eliminar colaborador"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else}
      <p class="no-data">No hay colaboradores registrados</p>
    {/if}
    
    <!-- Lista de certificaciones CON MEJORAS DE SELECCIÓN MASIVA -->
    <div class="certifications-header">
      <h3>Certificaciones Disponibles ({availableCertifications.length})</h3>
    </div>
    
    {#if availableCertifications.length > 0}
      <div class="certifications-list">
        <!-- SECCIÓN: Controles de selección masiva -->
        <div class="certifications-controls">
          <button 
            type="button"
            class="control-button select-all-btn" 
            on:click={selectAllCertifications}
            disabled={selectedCertifications.length === availableCertifications.length}
            title="Seleccionar todas las certificaciones"
          >
            <span class="control-icon">✅</span>
            <span class="control-text">Seleccionar Todas</span>
          </button>
          
          <button 
            type="button"
            class="control-button clear-all-btn" 
            on:click={clearAllCertifications}
            disabled={selectedCertifications.length === 0}
            title="Deseleccionar todas las certificaciones"
          >
            <span class="control-icon">❌</span>
            <span class="control-text">Deseleccionar Todas</span>
          </button>
          
          <!-- Contador visual -->
          <div class="selection-counter">
            <span class="counter-text">
              {selectedCertifications.length} de {availableCertifications.length} seleccionadas
            </span>
            <div class="progress-bar-mini">
              <div 
                class="progress-fill-mini" 
                style="width: {availableCertifications.length > 0 ? (selectedCertifications.length / availableCertifications.length) * 100 : 0}%"
              ></div>
            </div>
          </div>
        </div>
        
        <!-- Lista de certificaciones mejorada -->
        <div class="certification-items">
          {#each availableCertifications as cert}
            <div 
              class="certification-item {selectedCertifications.includes(cert) ? 'selected' : ''}"
              on:click={() => toggleCertification(cert)}
            >
              <span class="certification-name">{cert}</span>
              {#if selectedCertifications.includes(cert)}
                <span class="selected-indicator">✓</span>
              {/if}
            </div>
          {/each}
        </div>
        
        <div class="certification-info">
          <p class="help-text">
            Selecciona las certificaciones que posee el colaborador
            <br>
            Certificaciones seleccionadas: 
            <strong>
              {selectedCertifications.length > 0 
                ? selectedCertifications.join(', ') 
                : 'Ninguna'}
            </strong>
          </p>
        </div>
      </div>
    {:else}
      <p class="no-data">
        No hay certificaciones disponibles. Agregue roles primero en la sección de Gestión de Roles
      </p>
    {/if}
  </div>


  <!-- Modal para días inhabilitados -->
{#if showDaysModal}
  <div class="modal-backdrop" on:click={closeDaysModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>
          Configurar disponibilidad
          {#if editingDaysForIndex >= 0 && editingDaysForIndex < collaborators.length}
            <span class="modal-subtitle">para {collaborators[editingDaysForIndex].name}</span>
          {/if}
        </h3>
        <button class="modal-close" on:click={closeDaysModal}>×</button>
      </div>
      
      <div class="modal-body">
        <!-- Días inhabilitados -->
        <div class="days-section">
          <div class="days-header">
            <h4>Días en que NO está disponible</h4>
            <div class="days-actions">
              <button class="days-action-button select-all" on:click={() => selectAllDays(true)}>
                Inhabilitar todos
              </button>
              <button class="days-action-button clear-all" on:click={() => selectAllDays(false)}>
                Habilitar todos
              </button>
            </div>
          </div>
          
          <p class="modal-description">
            Selecciona los días en que este colaborador NO está disponible:
          </p>
          
          <div class="days-grid">
            {#each Object.entries(tempUnavailableDays) as [day, isUnavailable]}
              <div 
                class="day-item {isUnavailable ? 'day-unavailable' : ''}"
                on:click={() => toggleDayAvailability(day)}
              >
                <div class="day-name">{dayTranslations[day]}</div>
                <div class="day-status">
                  {isUnavailable ? 'No disponible' : 'Disponible'}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-button" on:click={closeDaysModal}>Cancelar</button>
        <button class="action-button collaborators-button" on:click={saveDaysChanges}>
          Guardar Cambios
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal de estadísticas con carrusel navegable -->
{#if showStatsModal && selectedCollaboratorForStats}
  <div class="modal-backdrop" on:click={closeStatsModal}>
    <div class="modal-content stats-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>
          Estadísticas de {selectedCollaboratorForStats.name}
        </h3>
        <button class="modal-close" on:click={closeStatsModal}>×</button>
      </div>
      
      <div class="modal-body">
        <!-- Resumen general -->
        <div class="stats-summary">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="card-value">{collaboratorStats.totalAssignments}</div>
              <div class="card-label">Total Asignaciones</div>
            </div>
            <div class="summary-card">
              <div class="card-value">{collaboratorStats.rotations.length}</div>
              <div class="card-label">Rotaciones</div>
            </div>
            <div class="summary-card">
              <div class="card-value">{Object.keys(collaboratorStats.rolesFrequency).length}</div>
              <div class="card-label">Roles Diferentes</div>
            </div>
          </div>
        </div>

        <!-- Frecuencia de roles -->
        {#if Object.keys(collaboratorStats.rolesFrequency).length > 0}
          <div class="stats-section">
            <h4>Frecuencia por Rol</h4>
            <div class="roles-frequency">
              {#each Object.entries(collaboratorStats.rolesFrequency).sort((a, b) => b[1] - a[1]) as [role, count]}
                <div class="frequency-item">
                  <span class="role-name">{role}</span>
                  <div class="frequency-bar">
                    <div class="frequency-fill" style="width: {(count / collaboratorStats.totalAssignments) * 100}%"></div>
                    <span class="frequency-count">{count}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Historial de Rotaciones con Carrusel -->
        {#if collaboratorStats.rotations.length > 0}
          <div class="stats-section">
            <div class="rotations-header">
              <h4>Historial de Rotaciones</h4>
              {#if collaboratorStats.rotations.length > 1}
                <div class="carousel-controls">
                  <button 
                    class="carousel-btn prev-btn" 
                    on:click={() => navigateCarousel('prev')}
                    disabled={currentRotationIndex === 0}
                    title="Rotación anterior"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  
                  <span class="carousel-indicator">
                    {currentRotationIndex + 1} de {collaboratorStats.rotations.length}
                  </span>
                  
                  <button 
                    class="carousel-btn next-btn" 
                    on:click={() => navigateCarousel('next')}
                    disabled={currentRotationIndex === collaboratorStats.rotations.length - 1}
                    title="Siguiente rotación"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
              {/if}
            </div>
            
            <!-- Contenedor del carrusel -->
            <div class="rotations-carousel">
              <div class="carousel-container">
                <div 
                  class="carousel-track"
                  style="transform: translateX(-{currentRotationIndex * 100}%)"
                >
                  {#each collaboratorStats.rotations as rotation, index}
                    <div class="carousel-item">
                      <div class="rotation-card">
                        <div class="rotation-header">
                          <h5>{formatMonth(rotation.year, rotation.month)}</h5>
                          <div class="rotation-summary">
                            <span class="total-assignments">{rotation.totalAssignments} asignaciones</span>
                            <span class="days-worked">{rotation.daysWorked} días trabajados</span>
                          </div>
                        </div>
                        
                        <!-- Calendario mejorado -->
                        <div class="rotation-calendar-container">
                          <!-- Calendario central -->
                          <div class="rotation-calendar">
                            <div class="calendar-header">
                              <div class="calendar-day-header">Lun</div>
                              <div class="calendar-day-header">Mar</div>
                              <div class="calendar-day-header">Mié</div>
                              <div class="calendar-day-header">Jue</div>
                              <div class="calendar-day-header">Vie</div>
                            </div>
                            <div class="calendar-body">
                              {#each ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as dayId}
                                <div class="calendar-day {rotation.assignments[dayId].roles.length > 0 ? 'has-assignments' : ''}">
                                  {#if rotation.assignments[dayId].roles.length > 0}
                                    <div class="day-assignments">
                                      {#each rotation.assignments[dayId].roles as role}
                                        <div class="assignment-badge" title={role}>
                                          {role.length > 8 ? role.substring(0, 8) + '...' : role}
                                        </div>
                                      {/each}
                                    </div>
                                  {:else}
                                    <div class="no-assignment">-</div>
                                  {/if}
                                </div>
                              {/each}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
              
              <!-- Indicadores de puntos -->
              {#if collaboratorStats.rotations.length > 1}
                <div class="carousel-dots">
                  {#each collaboratorStats.rotations as _, index}
                    <button 
                      class="dot {index === currentRotationIndex ? 'active' : ''}"
                      on:click={() => goToRotation(index)}
                      title="Ir a rotación {index + 1}"
                    ></button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="no-data">
            Este colaborador no tiene asignaciones en ninguna rotación registrada.
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="cancel-button" on:click={closeStatsModal}>Cerrar</button>
      </div>
    </div>
  </div>
{/if}

  
</section>