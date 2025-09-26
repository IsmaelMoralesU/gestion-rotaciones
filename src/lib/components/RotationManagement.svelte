<script>
  import '../styles/management.css';
  import { onMount, onDestroy } from 'svelte';
  import { db } from '../../lib/services/DatabaseService.js';
  import '../styles/rotation.css';

  // ==================== ESTADO PRINCIPAL ====================
  let roles = [];
  let collaborators = [];
  let rolesToCover = [];
  let mounted = false;
  
  // Estado para grupos de colores
  let roleColorGroups = {
    blue: [],
    orange: [],
    green: []
  };
  
  // Estado para asignaciones
  let assignments = {};
  
  // Estado para UI
  let statusMessage = '';
  let isSuccess = true;
  let showMessage = false;
  let isLoading = false;
  
  // ==================== SISTEMA DE ROTACIÓN DINÁMICO ====================
  let rotationNumber = 1;
  let currentWeekDates = {
    monday: new Date(),
    friday: new Date()
  };
  let firstRotationDate = null;
  
  // Constantes
  const weekdays = [
    { id: 'monday', name: 'Lunes' },
    { id: 'tuesday', name: 'Martes' },
    { id: 'wednesday', name: 'Miércoles' },
    { id: 'thursday', name: 'Jueves' },
    { id: 'friday', name: 'Viernes' }
  ];
  
  // Modal de asignación
  let showAssignModal = false; 
  let selectedRole = null;
  let selectedDay = null;
  let filteredCollaborators = [];
  let currentlyAssigned = [];

  // Variables para cleanup de suscripciones
  let unsubscribeRoles = null;
  let unsubscribeCollabs = null;
  let unsubscribeCoverage = null;

  // ==================== INICIALIZACIÓN PRINCIPAL ====================
  
  onMount(async () => {
    try {
      console.log('🚀 Inicializando RotationManagement...');
      
      await db.init();
      console.log('✅ Servicio de base de datos inicializado');
      
      await loadAllData();
      await initializeRotationSystem();
      
      unsubscribeRoles = db.subscribe('roles', handleRoleChanges);
      unsubscribeCollabs = db.subscribe('collaborators', handleCollaboratorChanges);
      unsubscribeCoverage = db.subscribe('coverage', handleCoverageChanges);
      
      console.log('✅ Suscripciones configuradas');
      
      mounted = true;
      console.log('✅ RotationManagement inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error en inicialización:', error);
      await setupFirstRotation();
      await loadFromLocalStorageFallback();
      initializeEmptyAssignments();
      mounted = true;
    }
  });
  
  onDestroy(() => {
    if (unsubscribeRoles) unsubscribeRoles();
    if (unsubscribeCollabs) unsubscribeCollabs();
    if (unsubscribeCoverage) unsubscribeCoverage();
  });
  
  // ==================== FUNCIONES DE CARGA DE DATOS UNIFICADAS ====================
  
  async function loadAllData() {
    try {
      console.log('📖 Cargando datos desde servicio...');
      
      const [loadedRoles, loadedCollaborators, coverageData, colorGroupsData] = await Promise.all([
        db.getAll('roles'),
        db.getAll('collaborators'),
        db.getById('coverage', 1),
        db.getById('colorGroups', 1)
      ]);
      
      roles = loadedRoles || [];
      collaborators = (loadedCollaborators || []).map(normalizeCollaborator);
      rolesToCover = coverageData?.roleNames || [];
      roleColorGroups = colorGroupsData?.groups || { blue: [], orange: [], green: [] };
      
      console.log(`✅ Datos cargados: ${roles.length} roles, ${collaborators.length} colaboradores`);
      
    } catch (error) {
      console.error('❌ Error cargando datos desde servicio:', error);
      await loadFromLocalStorageFallback();
    }
  }
  
  async function loadFromLocalStorageFallback() {
    console.log('🔍 Usando fallback a localStorage...');
    
    try {
      const savedRoles = localStorage.getItem('gestionRotaciones_roles');
      const savedCollaborators = localStorage.getItem('gestionRotaciones_collaborators');
      const savedCoverage = localStorage.getItem('gestionRotaciones_coverage');
      const savedColorGroups = localStorage.getItem('gestionRotaciones_colorGroups');
      
      roles = savedRoles ? JSON.parse(savedRoles) : [];
      collaborators = savedCollaborators ? JSON.parse(savedCollaborators).map(normalizeCollaborator) : [];
      rolesToCover = savedCoverage ? JSON.parse(savedCoverage) : [];
      roleColorGroups = savedColorGroups ? JSON.parse(savedColorGroups) : { blue: [], orange: [], green: [] };
      
      console.log('💾 Datos cargados desde localStorage');
    } catch (error) {
      console.error('❌ Error en fallback localStorage:', error);
    }
  }

  // ==================== FUNCIONES DE GUARDADO UNIFICADAS ====================
  
  async function saveAssignments() {
    if (!mounted) return;
    
    try {
      await saveRotationWithMetadata();
      console.log('✅ Rotación guardada correctamente');
    } catch (error) {
      console.error('❌ Error guardando rotación:', error);
    }
  }

  async function saveRotationWithMetadata() {
    try {
      const rotationData = {
        id: `rotation_${rotationNumber}`,
        rotationNumber: rotationNumber,
        year: currentWeekDates.monday ? currentWeekDates.monday.getFullYear() : new Date().getFullYear(),
        month: currentWeekDates.monday ? currentWeekDates.monday.getMonth() + 1 : new Date().getMonth() + 1,
        weekStartDate: currentWeekDates.monday ? currentWeekDates.monday.toISOString() : new Date().toISOString(),
        weekEndDate: currentWeekDates.friday ? currentWeekDates.friday.toISOString() : new Date().toISOString(),
        assignments: assignments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      try {
        await db.save('rotations', rotationData);
        console.log(`✅ Rotación #${rotationNumber} guardada en BD`);
      } catch (dbError) {
        console.log('⚠️ Error guardando en BD:', dbError);
      }
      
      const simpleKey = `gestionRotaciones_rotation_${rotationNumber}`;
      localStorage.setItem(simpleKey, JSON.stringify(rotationData));
      localStorage.setItem('gestionRotaciones_currentRotation', JSON.stringify(rotationData));
      
      const config = {
        firstRotationDate: firstRotationDate ? firstRotationDate.toISOString() : new Date().toISOString(),
        currentRotation: rotationNumber,
        totalRotations: rotationNumber,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem('gestionRotaciones_config', JSON.stringify(config));
      
    } catch (error) {
      console.error('❌ Error guardando rotación:', error);
    }
  }

  // ==================== CARGA Y NAVEGACIÓN DE ROTACIONES ====================
  
  async function loadRotationAssignments(rotationNum) {
    try {
      console.log(`🔍 Cargando rotación #${rotationNum}...`);
      
      const emptyAssignments = {};
      weekdays.forEach(day => {
        emptyAssignments[day.id] = {};
      });
      assignments = emptyAssignments;
      
      let foundRotation = null;
      
      try {
        const allRotations = await db.getAll('rotations');
        foundRotation = allRotations.find(r => r.rotationNumber === rotationNum);
      } catch (error) {
        console.log('⚠️ BD no disponible, buscando en localStorage...');
      }
      
      if (!foundRotation) {
        const possibleKeys = [
          `gestionRotaciones_rotation_${rotationNum}`,
          'gestionRotaciones_currentRotation'
        ];
        
        for (const key of possibleKeys) {
          const savedData = localStorage.getItem(key);
          if (savedData) {
            try {
              const parsed = JSON.parse(savedData);
              if (parsed.rotationNumber === rotationNum || rotationNum === 1) {
                foundRotation = parsed;
                break;
              }
            } catch (error) {
              console.log(`❌ Error parseando ${key}:`, error);
            }
          }
        }
      }
      
      if (foundRotation && foundRotation.assignments) {
        assignments = { ...foundRotation.assignments };
        console.log(`✅ Asignaciones de rotación #${rotationNum} cargadas correctamente`);
        assignments = assignments; // Forzar reactividad
      } else {
        console.log(`ℹ️ Rotación #${rotationNum} no encontrada - iniciando vacía`);
      }
      
    } catch (error) {
      console.error('❌ Error cargando rotación:', error);
      initializeEmptyAssignments();
    }
  }

  async function initializeRotationSystem() {
    try {
      console.log('🔄 Inicializando sistema de rotaciones...');
      
      let config = null;
      try {
        const savedConfig = localStorage.getItem('gestionRotaciones_config');
        if (savedConfig) {
          config = JSON.parse(savedConfig);
        }
      } catch (error) {
        console.log('⚠️ Error cargando configuración:', error);
      }
      
      if (config && config.currentRotation) {
        rotationNumber = config.currentRotation;
        
        if (config.firstRotationDate) {
          firstRotationDate = new Date(config.firstRotationDate);
          
          const weeksFromFirst = rotationNumber - 1;
          const mondayDate = new Date(firstRotationDate);
          mondayDate.setDate(mondayDate.getDate() + (weeksFromFirst * 7));
          
          const fridayDate = new Date(mondayDate);
          fridayDate.setDate(fridayDate.getDate() + 4);
          
          currentWeekDates = { monday: mondayDate, friday: fridayDate };
        }
      } else {
        rotationNumber = 1;
        currentWeekDates = calculateNextWeekDates();
        firstRotationDate = null;
      }
      
      await loadRotationAssignments(rotationNumber);
      
    } catch (error) {
      console.error('❌ Error inicializando sistema:', error);
      rotationNumber = 1;
      currentWeekDates = calculateNextWeekDates();
      firstRotationDate = null;
    }
  }

  function advanceToNextRotation() {
    try {
      if (hasAnyAssignments()) {
        saveAssignments();
      }
      
      rotationNumber += 1;
      
      if (firstRotationDate) {
        currentWeekDates = calculateWeekDatesFromFirst(firstRotationDate, rotationNumber - 1);
      } else {
        const newMonday = new Date(currentWeekDates.monday);
        newMonday.setDate(newMonday.getDate() + 7);
        
        const newFriday = new Date(currentWeekDates.friday);
        newFriday.setDate(newFriday.getDate() + 7);
        
        currentWeekDates = { monday: newMonday, friday: newFriday };
      }
      
      loadRotationAssignments(rotationNumber);
      showStatusMessage(`Avanzado a Rotación #${rotationNumber}`, true);
      
    } catch (error) {
      console.error('Error avanzando rotación:', error);
      showStatusMessage('Error avanzando rotación', false);
    }
  }
  
  function goToPreviousRotation() {
    try {
      if (rotationNumber > 1) {
        if (hasAnyAssignments()) {
          saveAssignments();
        }
        
        rotationNumber -= 1;
        
        if (firstRotationDate) {
          currentWeekDates = calculateWeekDatesFromFirst(firstRotationDate, rotationNumber - 1);
        } else {
          const newMonday = new Date(currentWeekDates.monday);
          newMonday.setDate(newMonday.getDate() - 7);
          
          const newFriday = new Date(currentWeekDates.friday);
          newFriday.setDate(newFriday.getDate() - 7);
          
          currentWeekDates = { monday: newMonday, friday: newFriday };
        }
        
        loadRotationAssignments(rotationNumber);
        showStatusMessage(`Retrocedido a Rotación #${rotationNumber}`, true);
      }
    } catch (error) {
      console.error('Error retrocediendo rotación:', error);
      showStatusMessage('Error retrocediendo rotación', false);
    }
  }

  // ==================== FUNCIONES DE CÁLCULO DE FECHAS ====================
  
  function calculateWeekDatesFromFirst(firstDate, weeksToAdd) {
    try {
      const monday = new Date(firstDate);
      monday.setDate(firstDate.getDate() + (weeksToAdd * 7));
      
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      
      return { monday, friday };
    } catch (error) {
      console.error('Error calculando fechas de semana:', error);
      return calculateNextWeekDates();
    }
  }


  // Reemplaza tu función calculateNextWeekDates() con esta:

function calculateNextWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=domingo, 1=lunes, etc.
  
  // Calcular cuántos días hasta el lunes de esta semana
  let daysToMonday;
  if (dayOfWeek === 0) daysToMonday = 1;      // Domingo -> mañana es lunes
  else if (dayOfWeek === 1) daysToMonday = 0; // Ya es lunes
  else daysToMonday = -(dayOfWeek - 1);       // Regresar al lunes de esta semana
  
  // Si es fin de semana, ir al próximo lunes
  if (dayOfWeek === 6) daysToMonday = 2; // Sábado -> lunes en 2 días
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  return { monday, friday };
}

  // ==================== FUNCIONES DE FORMATO ====================
  
  function formatDate(date) {
    try {
      if (!date || !(date instanceof Date)) {
        return 'Fecha no disponible';
      }
      
      const options = { 
        day: 'numeric', 
        month: 'long',
        timeZone: 'America/Costa_Rica'
      };
      return date.toLocaleDateString('es-ES', options);
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return 'Fecha inválida';
    }
  }
  
  function formatDayNumber(date) {
    try {
      if (!date || !(date instanceof Date)) {
        return '??';
      }
      return date.getDate();
    } catch (error) {
      return '??';
    }
  }
  
  function generateRotationTitle() {
    try {
      if (!currentWeekDates.monday || !currentWeekDates.friday) {
        return `Rotación #${rotationNumber}`;
      }
      
      const monthName = currentWeekDates.monday.toLocaleString('es-ES', { month: 'long' });
      const year = currentWeekDates.monday.getFullYear();
      const mondayFormatted = formatDate(currentWeekDates.monday);
      const fridayFormatted = formatDate(currentWeekDates.friday);
      
      return `Rotación #${rotationNumber} / ${monthName} / ${mondayFormatted} - ${fridayFormatted} / ${year}`;
    } catch (error) {
      return `Rotación #${rotationNumber}`;
    }
  }
  
  function generateShortRotationTitle() {
    try {
      if (!currentWeekDates.monday || !currentWeekDates.friday) {
        return `Rot. #${rotationNumber}`;
      }
      
      const monthName = currentWeekDates.monday.toLocaleString('es-ES', { month: 'short' });
      const year = currentWeekDates.monday.getFullYear();
      const mondayDay = formatDayNumber(currentWeekDates.monday);
      const fridayDay = formatDayNumber(currentWeekDates.friday);
      
      return `Rot. #${rotationNumber} / ${monthName} / ${mondayDay}-${fridayDay} / ${year}`;
    } catch (error) {
      return `Rot. #${rotationNumber}`;
    }
  }

  // ==================== FUNCIONES DE ESTADO ====================
  
  function getRotationStatusInfo() {
    try {
      const today = new Date();
      const monday = currentWeekDates.monday;
      const friday = currentWeekDates.friday;
      
      if (!monday || !friday) {
        return {
          isCurrentWeek: false,
          isFutureWeek: true,
          isPastWeek: false,
          statusText: 'Calculando...'
        };
      }
      
      const isCurrentWeek = monday <= today && today <= friday;
      const isFutureWeek = monday > today;
      const isPastWeek = friday < today;
      
      return {
        isCurrentWeek,
        isFutureWeek,
        isPastWeek,
        statusText: isCurrentWeek ? 'Semana Actual' : 
                    isFutureWeek ? 'Semana Futura' : 'Semana Pasada'
      };
    } catch (error) {
      return {
        isCurrentWeek: false,
        isFutureWeek: true,
        isPastWeek: false,
        statusText: 'Estado desconocido'
      };
    }
  }

  // ==================== HANDLERS DE SINCRONIZACIÓN SIMPLIFICADOS ====================
  
  function handleRoleChanges(event) {
    if (event.action === 'save' || event.action === 'saveAll') {
      loadRolesFromService();
    }
  }
  
  function handleCollaboratorChanges(event) {
    if (event.action === 'save' || event.action === 'saveAll') {
      loadCollaboratorsFromService();
    }
  }
  
  function handleCoverageChanges(event) {
    if (event.action === 'save') {
      loadCoverageFromService();
    }
  }
  
  async function loadRolesFromService() {
    try {
      const loadedRoles = await db.getAll('roles');
      roles = loadedRoles || [];
    } catch (error) {
      console.error('❌ Error recargando roles:', error);
    }
  }
  
  async function loadCollaboratorsFromService() {
    try {
      const loadedCollaborators = await db.getAll('collaborators');
      collaborators = (loadedCollaborators || []).map(normalizeCollaborator);
    } catch (error) {
      console.error('❌ Error recargando colaboradores:', error);
    }
  }
  
  async function loadCoverageFromService() {
    try {
      const coverageData = await db.getById('coverage', 1);
      rolesToCover = coverageData?.roleNames || [];
    } catch (error) {
      console.error('❌ Error recargando cobertura:', error);
    }
  }

  // ==================== FUNCIONES AUXILIARES ESENCIALES ====================
  
  function normalizeCollaborator(collab) {
    return {
      ...collab,
      certifications: Array.isArray(collab.certifications) ? collab.certifications : 
                    (collab.certifications ? [collab.certifications] : []),
      unavailableDays: collab.unavailableDays || {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false
      }
    };
  }

  function initializeEmptyAssignments() {
    const emptyAssignments = {};
    weekdays.forEach(day => {
      emptyAssignments[day.id] = {};
    });
    assignments = emptyAssignments;
    console.log('📋 Asignaciones inicializadas como vacías');
  }

  async function setupFirstRotation() {
    try {
      currentWeekDates = calculateNextWeekDates();
      rotationNumber = 1;
      firstRotationDate = null;
      console.log('📅 Primera rotación preparada para:', formatDate(currentWeekDates.monday));
    } catch (error) {
      console.error('Error configurando primera rotación:', error);
      rotationNumber = 1;
      currentWeekDates = { monday: new Date(), friday: new Date() };
    }
  }

  // ==================== FUNCIONES DE GRUPOS DE COLORES ====================
  
  function getColorGroupedRoles() {
    const groups = {};
    
    Object.entries(roleColorGroups).forEach(([colorId, roleNames]) => {
      if (roleNames.length > 0) {
        groups[colorId] = roleNames.filter(roleName => 
          roles.some(role => role.name === roleName)
        );
      }
    });
    
    return groups;
  }

  function getRoleColorGroup(roleName) {
    for (const [colorId, roleNames] of Object.entries(roleColorGroups)) {
      if (roleNames.includes(roleName)) {
        return colorId;
      }
    }
    return null;
  }

  function getUngroupedRoles() {
    const groupedRoleNames = Object.values(roleColorGroups).flat();
    return roles.filter(role => !groupedRoleNames.includes(role.name));
  }

  // ==================== ALGORITMO MEJORADO PARA EVITAR REPETICIÓN DE ROLES ====================
  
  class EnhancedConsecutiveTracker {
    constructor() {
      this.collaboratorRoleHistory = new Map();
      this.weeklyRoleAssignments = new Map(); // NUEVO: Rastrear roles por semana
      this.weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    }
    
    initializeFromExistingAssignments(assignments) {
      this.weekdays.forEach((dayId, dayIndex) => {
        const dayAssignments = assignments[dayId] || {};
        
        Object.entries(dayAssignments).forEach(([roleName, assignedCollabs]) => {
          if (Array.isArray(assignedCollabs)) {
            assignedCollabs.forEach(collabName => {
              this.recordAssignment(collabName, roleName, dayIndex);
            });
          }
        });
      });
    }
    
    recordAssignment(collaboratorName, roleName, dayIndex) {
      // Registro histórico para días consecutivos
      if (!this.collaboratorRoleHistory.has(collaboratorName)) {
        this.collaboratorRoleHistory.set(collaboratorName, new Map());
      }
      const roleHistory = this.collaboratorRoleHistory.get(collaboratorName);
      roleHistory.set(roleName, dayIndex);
      
      // NUEVO: Registro semanal para evitar repetición de roles
      if (!this.weeklyRoleAssignments.has(collaboratorName)) {
        this.weeklyRoleAssignments.set(collaboratorName, new Set());
      }
      this.weeklyRoleAssignments.get(collaboratorName).add(roleName);
    }
    
    wouldCreateConsecutiveDays(collaboratorName, roleName, dayIndex) {
      const roleHistory = this.collaboratorRoleHistory.get(collaboratorName);
      if (!roleHistory || !roleHistory.has(roleName)) {
        return false;
      }
      
      const lastAssignedDay = roleHistory.get(roleName);
      return Math.abs(dayIndex - lastAssignedDay) === 1;
    }
    
    // NUEVO: Verificar si el colaborador ya tiene este rol asignado en la semana
    hasRoleThisWeek(collaboratorName, roleName) {
      const weeklyRoles = this.weeklyRoleAssignments.get(collaboratorName);
      return weeklyRoles ? weeklyRoles.has(roleName) : false;
    }
    
    // NUEVO: Obtener roles ya asignados en la semana para un colaborador
    getWeeklyRoles(collaboratorName) {
      return this.weeklyRoleAssignments.get(collaboratorName) || new Set();
    }
    
    // NUEVO: Estadísticas de diversidad
    getWeeklyDiversityStats() {
      const stats = {
        totalCollaborators: this.weeklyRoleAssignments.size,
        averageRolesPerCollaborator: 0,
        collaboratorDiversity: new Map(),
        perfectDiversityCount: 0
      };
      
      let totalRoles = 0;
      for (const [collabName, roles] of this.weeklyRoleAssignments) {
        const roleCount = roles.size;
        totalRoles += roleCount;
        
        stats.collaboratorDiversity.set(collabName, {
          rolesCount: roleCount,
          roles: Array.from(roles)
        });
      }
      
      stats.averageRolesPerCollaborator = stats.totalCollaborators > 0 
        ? (totalRoles / stats.totalCollaborators) 
        : 0;
      
      return stats;
    }
  }

  async function generateRotation() {
    if (!roles.length || !collaborators.length) {
      showStatusMessage('No hay suficientes datos para generar rotación', false);
      return;
    }

    try {
      if (!firstRotationDate) {
        firstRotationDate = new Date(currentWeekDates.monday);
        console.log('✅ Primera rotación establecida:', formatDate(firstRotationDate));
      }

      isLoading = true;

      const newAssignments = {};
      weekdays.forEach(day => {
        newAssignments[day.id] = {};
        
        roles.forEach(role => {
          if (!isRoleExcludedForDay(role, day.id)) {
            newAssignments[day.id][role.name] = [];
          }
        });
        
        const existingDayAssignments = assignments[day.id] || {};
        Object.entries(existingDayAssignments).forEach(([roleName, assignedCollabs]) => {
          if (Array.isArray(assignedCollabs) && assignedCollabs.length > 0) {
            const validCollaborators = assignedCollabs.filter(name => 
              typeof name === 'string' && 
              !name.includes('Faltan') && 
              !name.includes('Sin') &&
              !name.includes('Omitido')
            );
            
            if (validCollaborators.length > 0 && newAssignments[day.id][roleName]) {
              newAssignments[day.id][roleName] = [...validCollaborators];
            }
          }
        });
      });

      const consecutiveTracker = new EnhancedConsecutiveTracker();
      consecutiveTracker.initializeFromExistingAssignments(newAssignments);

      const success = await generateWeekOptimizedEnhanced(newAssignments, consecutiveTracker);

      if (success) {
        await assignRemainingCollaborators(newAssignments);
        assignments = newAssignments;
        await saveAssignments();

        // Obtener estadísticas de la rotación generada
        const finalTracker = new EnhancedConsecutiveTracker();
        finalTracker.initializeFromExistingAssignments(newAssignments);
        const diversityStats = finalTracker.getWeeklyDiversityStats();
        
        const extraAssignments = countExtraAssignments(newAssignments);
        showStatusMessage(
          `Rotación #${rotationNumber} generada exitosamente. ` +
          `Colaboradores sin repetir roles: ${diversityStats.perfectDiversityCount}/${diversityStats.totalCollaborators}. ` +
          `Colaboradores adicionales: ${extraAssignments}`, 
          true
        );
      } else {
        showStatusMessage('No se pudo generar una rotación óptima. Intente ajustar la configuración.', false);
      }

    } catch (error) {
      console.error('❌ Error generando rotación:', error);
      showStatusMessage('Error al generar rotación: ' + error.message, false);
    } finally {
      setTimeout(() => {
        isLoading = false;
      }, 500);
    }
  }

  async function generateWeekOptimizedEnhanced(newAssignments, tracker) {
    const maxAttempts = 8; // Aumentar intentos para mejor optimización
    let bestAssignments = null;
    let bestEvaluation = { score: Infinity };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptAssignments = JSON.parse(JSON.stringify(newAssignments));
      const attemptTracker = new EnhancedConsecutiveTracker();
      attemptTracker.initializeFromExistingAssignments(attemptAssignments);

      const success = await generateSingleWeekAttemptEnhanced(attemptAssignments, attemptTracker);

      if (success) {
        const evaluation = evaluateAssignmentQualityEnhanced(attemptAssignments);
        
        console.log(`🔄 Intento ${attempt}: Score=${evaluation.score}, Consecutivos=${evaluation.consecutiveCount}, Repeticiones=${evaluation.roleRepetitionCount}`);
        
        if (evaluation.score < bestEvaluation.score) {
          bestEvaluation = evaluation;
          bestAssignments = JSON.parse(JSON.stringify(attemptAssignments));
        }

        // Si encontramos una solución perfecta, parar
        if (evaluation.consecutiveCount === 0 && evaluation.roleRepetitionCount === 0) {
          console.log(`🎯 ¡Solución perfecta encontrada en intento ${attempt}!`);
          break;
        }
      }
    }

    if (bestAssignments) {
      Object.assign(newAssignments, bestAssignments);
      
      // Mostrar estadísticas finales
      console.log(`📊 Resultado final:`, bestEvaluation);
      
      return true;
    }

    return false;
  }

  async function generateSingleWeekAttemptEnhanced(attemptAssignments, tracker) {
    const collaboratorsUsedPerDay = new Map();
    
    weekdays.forEach(day => {
      const usedToday = new Set();
      const dayAssignments = attemptAssignments[day.id] || {};
      
      Object.values(dayAssignments).forEach(assignedCollabs => {
        if (Array.isArray(assignedCollabs)) {
          assignedCollabs.forEach(name => usedToday.add(name));
        }
      });
      
      collaboratorsUsedPerDay.set(day.id, usedToday);
    });

    // PASO 1: Asignar grupos de colores con prioridad de no repetición
    for (let dayIndex = 0; dayIndex < weekdays.length; dayIndex++) {
      const day = weekdays[dayIndex];
      const success = await assignColorGroupsForDayEnhanced(
        day.id, 
        dayIndex, 
        attemptAssignments, 
        tracker,
        collaboratorsUsedPerDay.get(day.id)
      );

      if (!success) return false;
    }

    // PASO 2: Asignar roles individuales con prioridad de no repetición
    for (let dayIndex = 0; dayIndex < weekdays.length; dayIndex++) {
      const day = weekdays[dayIndex];
      const success = await assignIndividualRolesForDayEnhanced(
        day.id, 
        dayIndex, 
        attemptAssignments, 
        tracker,
        collaboratorsUsedPerDay.get(day.id)
      );

      if (!success) return false;
    }

    return true;
  }

  async function assignColorGroupsForDayEnhanced(dayId, dayIndex, newAssignments, tracker, usedToday) {
    const colorGroups = getColorGroupedRoles();
    const availableCollaborators = collaborators.filter(collab => 
      !collab.unavailableDays?.[dayId] && !usedToday.has(collab.name)
    );

    for (const [colorId, groupRoleNames] of Object.entries(colorGroups)) {
      if (groupRoleNames.length === 0) continue;

      const groupRoles = groupRoleNames
        .map(roleName => roles.find(r => r.name === roleName))
        .filter(role => role && !isRoleExcludedForDay(role, dayId));

      if (groupRoles.length === 0) continue;

      // NUEVO: Buscar colaboradores que puedan hacer todos los roles SIN repetir
      const eligibleCollaborators = availableCollaborators.filter(collab => {
        if (usedToday.has(collab.name)) return false;
        
        // Debe poder hacer todos los roles del grupo
        const canDoAllRoles = groupRoles.every(role => 
          collab.certifications?.includes(role.name)
        );
        
        if (!canDoAllRoles) return false;
        
        // NUEVO: No debe haber hecho ninguno de estos roles esta semana
        const hasAnyRoleThisWeek = groupRoles.some(role => 
          tracker.hasRoleThisWeek(collab.name, role.name)
        );
        
        return !hasAnyRoleThisWeek;
      });

      // Asignar colaboradores a todos los roles del grupo
      const maxNeededForGroup = Math.max(...groupRoles.map(role => {
        const currentAssigned = newAssignments[dayId][role.name].length;
        const minRequired = role.min || 1;
        return Math.max(0, minRequired - currentAssigned);
      }));

      for (let assignmentIndex = 0; assignmentIndex < maxNeededForGroup; assignmentIndex++) {
        let selectedCollaborator;
        
        // Intentar primero con colaboradores que no repiten roles
        if (eligibleCollaborators.length > 0) {
          selectedCollaborator = selectBestFromCandidatesEnhanced(
            eligibleCollaborators.filter(c => !usedToday.has(c.name)), 
            groupRoles[0], // Usar el primer rol como referencia
            tracker, 
            dayIndex
          );
        }
        
        // Si no hay colaboradores sin repetir, usar el algoritmo original
        if (!selectedCollaborator) {
          selectedCollaborator = findBestCollaboratorForColorGroup(
            groupRoles,
            availableCollaborators.filter(c => !usedToday.has(c.name)),
            tracker,
            dayIndex
          );
        }

        if (!selectedCollaborator) continue;

        // Asignar a todos los roles del grupo que necesiten colaboradores
        let assignedToAnyRole = false;
        for (const role of groupRoles) {
          const currentAssigned = newAssignments[dayId][role.name].length;
          const minRequired = role.min || 1;
          const maxAllowed = getMaxAllowedForDay(role, dayId);

          if (currentAssigned < minRequired && currentAssigned < maxAllowed) {
            newAssignments[dayId][role.name].push(selectedCollaborator.name);
            tracker.recordAssignment(selectedCollaborator.name, role.name, dayIndex);
            assignedToAnyRole = true;
          }
        }

        if (assignedToAnyRole) {
          usedToday.add(selectedCollaborator.name);
          // Remover de la lista de elegibles para esta iteración
          const index = eligibleCollaborators.findIndex(c => c.name === selectedCollaborator.name);
          if (index !== -1) {
            eligibleCollaborators.splice(index, 1);
          }
        }
      }
    }

    return true;
  }

  async function assignIndividualRolesForDayEnhanced(dayId, dayIndex, newAssignments, tracker, usedToday) {
    const ungroupedRoles = getUngroupedRoles().filter(role => !isRoleExcludedForDay(role, dayId));
    const availableCollaborators = collaborators.filter(collab => 
      !collab.unavailableDays?.[dayId] && !usedToday.has(collab.name)
    );

    for (const role of ungroupedRoles) {
      const currentAssigned = newAssignments[dayId][role.name]?.length || 0;
      const minRequired = role.min || 1;
      const stillNeeded = Math.max(0, minRequired - currentAssigned);

      for (let i = 0; i < stillNeeded; i++) {
        // NUEVO: Usar función mejorada que prioriza no repetir roles
        const bestCollaborator = await findBestCollaboratorForRoleEnhanced(
          role,
          availableCollaborators.filter(c => !usedToday.has(c.name)),
          tracker,
          dayIndex
        );

        if (!bestCollaborator) break;

        if (!newAssignments[dayId][role.name]) {
          newAssignments[dayId][role.name] = [];
        }

        newAssignments[dayId][role.name].push(bestCollaborator.name);
        usedToday.add(bestCollaborator.name);
        tracker.recordAssignment(bestCollaborator.name, role.name, dayIndex);
      }
    }

    return true;
  }

  async function findBestCollaboratorForRoleEnhanced(role, availableCollaborators, tracker, dayIndex) {
  // PASO 1: Filtrar colaboradores que pueden hacer el rol sin repetir
  const noRepeatCandidates = availableCollaborators.filter(collab => {
    // Verificar certificaciones
    if (!collab.certifications?.includes(role.name)) {
      return false;
    }
    
    // ✅ ESTE ES EL CAMBIO CLAVE: Ya está verificando repetición de roles
    // Verificar que no haya tenido este rol en la semana
    if (tracker.hasRoleThisWeek(collab.name, role.name)) {
      return false;
    }
    
    // Verificar dÍas consecutivos
    if (tracker.wouldCreateConsecutiveDays(collab.name, role.name, dayIndex)) {
      return false;
    }
    
    return true;
  });
  
  // ✅ Y ESTE CAMBIO: Dar mayor prioridad a la diversidad
  // PASO 2: Si hay candidatos sin repetir, usarlos
  if (noRepeatCandidates.length > 0) {
    return selectBestFromCandidatesEnhanced(noRepeatCandidates, role, tracker, dayIndex);
  }
  
  // PASO 3: Si no hay candidatos sin repetir, usar el algoritmo original
  console.log(`⚠️ No hay colaboradores disponibles para ${role.name} sin repetir rol - usando asignación tradicional`);
  return findBestCollaboratorForRole(role, availableCollaborators, tracker, dayIndex);
}

 function selectBestFromCandidatesEnhanced(candidates, role, tracker, dayIndex) {
  if (candidates.length === 0) return null;
  
  // Calcular puntuaciones para cada candidato
  const candidatesWithScores = candidates.map(collab => {
    let score = 0;
    
    // ✅ BONUS GRANDE por diversidad (menos roles = mejor)
    const weeklyRoles = tracker.getWeeklyRoles(collab.name);
    score += (10 - weeklyRoles.size) * 50; // ⬅️ AUMENTAR ESTE MULTIPLICADOR de 20 a 50
    
    // Bonus por no haber trabajado días consecutivos recientemente
    const consecutivePenalty = tracker.wouldCreateConsecutiveDays(collab.name, role.name, dayIndex) ? 1000 : 0;
    score -= consecutivePenalty;
    
    // Factor aleatorio para variedad (reducir para dar más peso a diversidad)
    const randomFactor = Math.random() * 5; // ⬅️ REDUCIR de 15 a 5
    score += randomFactor;
    
    return { 
      collaborator: collab, 
      score, 
      weeklyRolesCount: weeklyRoles.size,
      wouldBeConsecutive: consecutivePenalty > 0
    };
  });
  
  // Ordenar por puntuación (mayor = mejor)
  candidatesWithScores.sort((a, b) => b.score - a.score);
  
  // ✅ Seleccionar el mejor candidato (no aleatorio para mayor consistencia)
  return candidatesWithScores[0].collaborator; // ⬅️ CAMBIAR de selección aleatoria a mejor
}

  function evaluateAssignmentQualityEnhanced(assignments) {
    let totalScore = 0;
    let consecutiveCount = 0;
    let roleRepetitionCount = 0;
    
    const tracker = new EnhancedConsecutiveTracker();
    tracker.initializeFromExistingAssignments(assignments);
    
    // Evaluar días consecutivos (penalización alta)
    collaborators.forEach(collaborator => {
      const schedule = getCollaboratorSchedule(collaborator.name, assignments);
      
      for (let day = 0; day < schedule.length - 1; day++) {
        const todayRoles = schedule[day];
        const tomorrowRoles = schedule[day + 1];
        
        const repeatedRoles = todayRoles.filter(role => tomorrowRoles.includes(role));
        
        if (repeatedRoles.length > 0) {
          consecutiveCount += repeatedRoles.length;
          totalScore += repeatedRoles.length * 100; // Penalización alta
        }
      }
    });
    
    // NUEVO: Evaluar repetición de roles en la misma semana (penalización media)
    collaborators.forEach(collaborator => {
      const weeklyRoles = tracker.getWeeklyRoles(collaborator.name);
      const schedule = getCollaboratorSchedule(collaborator.name, assignments);
      
      // Contar roles únicos vs asignaciones totales
      const totalAssignments = schedule.flat().length;
      const uniqueRoles = weeklyRoles.size;
      
      if (totalAssignments > uniqueRoles) {
        const repetitions = totalAssignments - uniqueRoles;
        roleRepetitionCount += repetitions;
        totalScore += repetitions * 50; // Penalización media
      }
    });
    
    // NUEVO: Bonus por diversidad
    const diversityStats = tracker.getWeeklyDiversityStats();
    const diversityBonus = Math.floor(diversityStats.averageRolesPerCollaborator * 10);
    totalScore -= diversityBonus; // Menor score es mejor
    
    return {
      score: totalScore,
      consecutiveCount,
      roleRepetitionCount,
      diversityStats
    };
  }

  function findBestCollaboratorForColorGroup(groupRoles, availableCollaborators, tracker, dayIndex) {
    const candidates = availableCollaborators.filter(collab => {
      return groupRoles.every(role => collab.certifications?.includes(role.name));
    });
    
    if (candidates.length === 0) return null;
    
    const candidatesWithScores = candidates.map(collab => {
      const avgConsecutiveCost = groupRoles.reduce((sum, role) => {
        return sum + (tracker.wouldCreateConsecutiveDays(collab.name, role.name, dayIndex) ? 100 : 0);
      }, 0) / groupRoles.length;
      
      const randomFactor = Math.random() * 15;
      const totalScore = avgConsecutiveCost + randomFactor;
      
      return { collaborator: collab, score: totalScore, avgConsecutiveCost };
    });
    
    candidatesWithScores.sort((a, b) => a.score - b.score);
    
    const nonConsecutiveCandidates = candidatesWithScores.filter(c => c.avgConsecutiveCost === 0);
    
    if (nonConsecutiveCandidates.length > 0) {
      const topCandidates = nonConsecutiveCandidates.slice(0, Math.min(3, nonConsecutiveCandidates.length));
      const selectedIndex = Math.floor(Math.random() * topCandidates.length);
      return topCandidates[selectedIndex].collaborator;
    } else {
      const topOptions = candidatesWithScores.slice(0, Math.min(2, candidatesWithScores.length));
      const selectedIndex = Math.floor(Math.random() * topOptions.length);
      return topOptions[selectedIndex].collaborator;
    }
  }

  function findBestCollaboratorForRole(role, availableCollaborators, tracker, dayIndex) {
    const candidates = availableCollaborators.filter(collab => 
      collab.certifications?.includes(role.name)
    );
    
    if (candidates.length === 0) return null;
    
    const candidatesWithScores = candidates.map(collab => {
      const consecutiveCost = tracker.wouldCreateConsecutiveDays(collab.name, role.name, dayIndex) ? 100 : 0;
      const randomFactor = Math.random() * 15;
      const totalScore = consecutiveCost + randomFactor;
      
      return { collaborator: collab, score: totalScore, consecutiveCost };
    });
    
    candidatesWithScores.sort((a, b) => a.score - b.score);
    
    const nonConsecutiveCandidates = candidatesWithScores.filter(c => c.consecutiveCost === 0);
    
    if (nonConsecutiveCandidates.length > 0) {
      const topCandidates = nonConsecutiveCandidates.slice(0, Math.min(3, nonConsecutiveCandidates.length));
      const selectedIndex = Math.floor(Math.random() * topCandidates.length);
      return topCandidates[selectedIndex].collaborator;
    } else {
      const topOptions = candidatesWithScores.slice(0, Math.min(2, candidatesWithScores.length));
      const selectedIndex = Math.floor(Math.random() * topOptions.length);
      return topOptions[selectedIndex].collaborator;
    }
  }

  async function assignRemainingCollaborators(newAssignments) {
    for (let dayIndex = 0; dayIndex < weekdays.length; dayIndex++) {
      const day = weekdays[dayIndex];
      const dayId = day.id;
      const activeRoles = roles.filter(role => !isRoleExcludedForDay(role, dayId));
      
      const assignedToday = new Set();
      Object.values(newAssignments[dayId] || {}).forEach(assignedCollabs => {
        if (Array.isArray(assignedCollabs)) {
          assignedCollabs.forEach(name => assignedToday.add(name));
        }
      });
      
      let availableCollaborators = collaborators.filter(collab => 
        !collab.unavailableDays?.[dayId] && !assignedToday.has(collab.name)
      );
      
      availableCollaborators = shuffleArray(availableCollaborators);
      
      for (const collaborator of availableCollaborators) {
        let compatibleRoles = activeRoles.filter(role => {
          const canCover = collaborator.certifications?.includes(role.name);
          const currentAssigned = (newAssignments[dayId][role.name] || []).length;
          const maxAllowed = getMaxAllowedForDay(role, dayId);
          const hasCapacity = currentAssigned < maxAllowed;
          
          return canCover && hasCapacity;
        });
        
        if (compatibleRoles.length > 0) {
          compatibleRoles = shuffleArray(compatibleRoles);
          const bestRole = compatibleRoles[0];
          
          const colorGroup = getRoleColorGroup(bestRole.name);
          if (colorGroup && !hasManualAssignments(collaborator.name, dayId, newAssignments)) {
            const groupRoles = roleColorGroups[colorGroup]
              .map(roleName => roles.find(r => r.name === roleName))
              .filter(role => role && 
                             !isRoleExcludedForDay(role, dayId) && 
                             collaborator.certifications?.includes(role.name) &&
                             (newAssignments[dayId][role.name] || []).length < getMaxAllowedForDay(role, dayId));
            
            groupRoles.forEach(role => {
              if (!newAssignments[dayId][role.name]) {
                newAssignments[dayId][role.name] = [];
              }
              newAssignments[dayId][role.name].push(collaborator.name);
            });
          } else {
            if (!newAssignments[dayId][bestRole.name]) {
              newAssignments[dayId][bestRole.name] = [];
            }
            newAssignments[dayId][bestRole.name].push(collaborator.name);
          }
          
          assignedToday.add(collaborator.name);
        }
      }
    }
  }

  function getCollaboratorSchedule(collaboratorName, assignments) {
    const schedule = new Array(5).fill().map(() => []);
    
    weekdays.forEach((day, dayIndex) => {
      const dayAssignments = assignments[day.id] || {};
      
      Object.entries(dayAssignments).forEach(([roleName, assignedCollabs]) => {
        if (Array.isArray(assignedCollabs) && assignedCollabs.includes(collaboratorName)) {
          schedule[dayIndex].push(roleName);
        }
      });
    });
    
    return schedule;
  }

  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function countExtraAssignments(assignments) {
    let extraCount = 0;
    
    weekdays.forEach(day => {
      const dayAssignments = assignments[day.id] || {};
      const activeRoles = roles.filter(role => !isRoleExcludedForDay(role, day.id));
      
      activeRoles.forEach(role => {
        const assigned = dayAssignments[role.name] || [];
        const minimum = role.min || 1;
        const extras = Math.max(0, assigned.length - minimum);
        extraCount += extras;
      });
    });
    
    return extraCount;
  }

  function hasManualAssignments(collaboratorName, dayId, assignments) {
    const dayAssignments = assignments[dayId] || {};
    
    for (const [roleName, assignedCollabs] of Object.entries(dayAssignments)) {
      if (Array.isArray(assignedCollabs) && assignedCollabs.includes(collaboratorName)) {
        return true;
      }
    }
    
    return false;
  }

  // ==================== EXPORTACIÓN DE IMAGEN ====================

  async function exportRotationAsImage() {
    if (!hasAnyAssignments()) {
      showStatusMessage('No hay asignaciones para exportar', false);
      return;
    }

    try {
      isLoading = true;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const config = {
        width: 1800,
        height: Math.max(1000, roles.length * 90 + 400),
        padding: 50,
        colors: {
          background: '#1a1f35',
          cardBackground: 'rgba(255, 255, 255, 0.05)',
          headerCard: 'rgba(255, 255, 255, 0.08)',
          text: '#ffffff',
          textSecondary: 'rgba(255, 255, 255, 0.8)',
          textMuted: 'rgba(255, 255, 255, 0.6)',
          border: 'rgba(255, 255, 255, 0.1)',
          assigned: 'rgba(46, 204, 113, 0.3)',
          assignedBorder: 'rgba(46, 204, 113, 0.5)',
          warning: 'rgba(241, 196, 15, 0.3)',
          warningBorder: 'rgba(241, 196, 15, 0.5)',
          excluded: 'rgba(155, 89, 182, 0.2)',
          excludedBorder: 'rgba(155, 89, 182, 0.4)',
          accent: '#3498db'
        }
      };

      const dpr = window.devicePixelRatio || 1;
      canvas.width = config.width * dpr;
      canvas.height = config.height * dpr;
      canvas.style.width = config.width + 'px';
      canvas.style.height = config.height + 'px';
      ctx.scale(dpr, dpr);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      await drawModernBackground(ctx, config);
      await drawModernHeader(ctx, config);
      await drawModernTable(ctx, config);
      await drawModernFooter(ctx, config);
      await downloadCanvasAsImage(canvas);

      showStatusMessage('Rotación exportada con diseño moderno', true);

    } catch (error) {
      console.error('❌ Error exportando imagen:', error);
      showStatusMessage('Error al generar imagen: ' + error.message, false);
    } finally {
      setTimeout(() => {
        isLoading = false;
      }, 1000);
    }
  }

  async function drawModernBackground(ctx, config) {
    ctx.fillStyle = config.colors.background;
    ctx.fillRect(0, 0, config.width, config.height);

    const gradient1 = ctx.createRadialGradient(
      config.width * 0.8, config.height * 0.3, 0,
      config.width * 0.8, config.height * 0.3, config.width * 0.7
    );
    gradient1.addColorStop(0, 'rgba(52, 152, 219, 0.08)');
    gradient1.addColorStop(1, 'rgba(52, 152, 219, 0)');

    ctx.fillStyle = gradient1;
    ctx.fillRect(0, 0, config.width, config.height);
  }

  async function drawModernHeader(ctx, config) {
    const headerHeight = 140;
    const y = config.padding;

    drawGlassCard(ctx, config.padding, y, config.width - (config.padding * 2), headerHeight, 20);
    ctx.fillStyle = config.colors.headerCard;
    ctx.fill();
    ctx.strokeStyle = config.colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = config.colors.text;
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    
    const title = generateRotationTitle();
    ctx.fillText(title, config.width / 2, y + 45);
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = config.colors.textSecondary;
    
    const rotationStatus = getRotationStatusInfo();
    const statusText = `${rotationStatus.statusText} • ${getTotalAssignments()} asignaciones totales`;
    ctx.fillText(statusText, config.width / 2, y + 85);

    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = config.colors.textMuted;
    const dateInfo = `Generado el ${new Date().toLocaleDateString('es-ES', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    })}`;
    ctx.fillText(dateInfo, config.width / 2, y + 110);
  }

  async function drawModernTable(ctx, config) {
    const tableY = config.padding + 180;
    const tableWidth = config.width - (config.padding * 2);
    const roleColumnWidth = 300;
    const dayColumnWidth = (tableWidth - roleColumnWidth) / 5;
    const rowHeight = 80;
    const headerHeight = 60;

    const tableHeight = headerHeight + (roles.length * rowHeight);
    drawGlassCard(ctx, config.padding, tableY, tableWidth, tableHeight, 16);
    ctx.fillStyle = config.colors.cardBackground;
    ctx.fill();
    ctx.strokeStyle = config.colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    await drawTableHeaders(ctx, config, tableY, roleColumnWidth, dayColumnWidth, headerHeight);

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const rowY = tableY + headerHeight + (i * rowHeight);
      await drawTableRow(ctx, config, role, rowY, roleColumnWidth, dayColumnWidth, rowHeight, i);
    }
  }

  async function drawTableHeaders(ctx, config, tableY, roleWidth, dayWidth, headerHeight) {
    const headers = ['Roles y Requisitos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    
    headers.forEach((header, index) => {
      const x = config.padding + (index === 0 ? 0 : roleWidth + ((index - 1) * dayWidth));
      const width = index === 0 ? roleWidth : dayWidth;
      
      drawGlassCard(ctx, x + 5, tableY + 5, width - 10, headerHeight - 10, 12);
      ctx.fillStyle = index === 0 ? 'rgba(52, 152, 219, 0.1)' : 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
      ctx.strokeStyle = config.colors.border;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = config.colors.text;
      ctx.font = index === 0 ? 
        'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' :
        'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.fillText(header, x + width / 2, tableY + headerHeight / 2);
    });
  }

  async function drawTableRow(ctx, config, role, y, roleWidth, dayWidth, rowHeight, index) {
    const x = config.padding;
    
    if (index % 2 === 1) {
      drawGlassCard(ctx, x, y, config.width - (config.padding * 2), rowHeight, 0);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
      ctx.fill();
    }

    await drawRoleInfoColumn(ctx, config, role, x, y, roleWidth, rowHeight);

    for (let dayIndex = 0; dayIndex < weekdays.length; dayIndex++) {
      const dayId = weekdays[dayIndex].id;
      const cellX = x + roleWidth + (dayIndex * dayWidth);
      await drawDayColumn(ctx, config, role, dayId, cellX, y, dayWidth, rowHeight);
    }
  }

  async function drawRoleInfoColumn(ctx, config, role, x, y, width, height) {
    const padding = 15;
    const contentX = x + padding;
    const contentY = y + padding;

    ctx.fillStyle = config.colors.text;
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const roleName = truncateText(ctx, role.name, width - 40);
    ctx.fillText(roleName, contentX, contentY);

    const pillY = contentY + 30;
    let pillX = contentX;

    const minText = `Mín: ${role.min || 1}`;
    pillX += drawModernPill(ctx, pillX, pillY, minText, config.colors.accent, '#ffffff') + 10;

    const maxText = `Máx: ${role.max || 5}`;
    drawModernPill(ctx, pillX, pillY, maxText, '#2ecc71', '#ffffff');
  }

  async function drawDayColumn(ctx, config, role, dayId, x, y, width, height) {
    const padding = 8;
    const cellX = x + padding;
    const cellY = y + padding;
    const cellWidth = width - (padding * 2);
    const cellHeight = height - (padding * 2);

    let cellState = 'empty';
    let collaboratorsList = [];
    let assignedCount = 0;
    let requiredCount = role.min || 1;

    if (isRoleExcludedForDay(role, dayId)) {
      cellState = 'excluded';
    } else if (assignments && assignments[dayId] && assignments[dayId][role.name]) {
      const dayAssignments = assignments[dayId][role.name];
      
      if (Array.isArray(dayAssignments) && dayAssignments.length > 0) {
        const validAssignments = dayAssignments.filter(name => 
          typeof name === 'string' && !name.includes('Faltan') && !name.includes('Sin')
        );
        
        if (validAssignments.length > 0) {
          collaboratorsList = validAssignments;
          assignedCount = validAssignments.length;
          cellState = assignedCount >= requiredCount ? 'assigned' : 'warning';
        } else {
          cellState = 'warning';
        }
      }
    }

    let bgColor, borderColor, textColor;
    
    switch (cellState) {
      case 'assigned':
        bgColor = config.colors.assigned;
        borderColor = config.colors.assignedBorder;
        textColor = config.colors.text;
        break;
      case 'warning':
        bgColor = config.colors.warning;
        borderColor = config.colors.warningBorder;
        textColor = config.colors.text;
        break;
      case 'excluded':
        bgColor = config.colors.excluded;
        borderColor = config.colors.excludedBorder;
        textColor = config.colors.textMuted;
        break;
      default:
        bgColor = 'rgba(0, 0, 0, 0.1)';
        borderColor = 'rgba(255, 255, 255, 0.05)';
        textColor = config.colors.textMuted;
    }

    drawGlassCard(ctx, cellX, cellY, cellWidth, cellHeight, 12);
    ctx.fillStyle = bgColor;
    ctx.fill();
    
    if (cellState !== 'empty') {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (cellState === 'excluded') {
      ctx.fillStyle = textColor;
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚫', cellX + cellWidth / 2, cellY + cellHeight / 2 - 8);
      
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('No requerido', cellX + cellWidth / 2, cellY + cellHeight / 2 + 12);
      
    } else if (collaboratorsList.length > 0) {
      await drawCollaboratorsList(ctx, config, collaboratorsList, cellX, cellY, cellWidth, cellHeight, textColor);
      
      if (assignedCount > 0) {
        drawCountBadge(ctx, config, assignedCount, requiredCount, cellX + cellWidth - 25, cellY + 5);
      }
      
    } else if (cellState === 'warning') {
      ctx.fillStyle = textColor;
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠️', cellX + cellWidth / 2, cellY + cellHeight / 2 - 8);
      
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Sin asignar', cellX + cellWidth / 2, cellY + cellHeight / 2 + 12);
      
    } else {
      ctx.fillStyle = textColor;
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Disponible', cellX + cellWidth / 2, cellY + cellHeight / 2);
    }
  }

  async function drawCollaboratorsList(ctx, config, collaborators, x, y, width, height, textColor) {
    const padding = 8;
    const lineHeight = 16;
    const maxLines = Math.floor((height - padding * 2) / lineHeight);
    
    ctx.fillStyle = textColor;
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let currentY = y + padding;
    let lineCount = 0;

    for (let i = 0; i < collaborators.length && lineCount < maxLines; i++) {
      let name = collaborators[i];
      
      if (name.length > 15) {
        name = name.substring(0, 13) + '..';
      }
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('•', x + padding, currentY);
      
      ctx.fillStyle = textColor;
      ctx.fillText(name, x + padding + 15, currentY);
      
      currentY += lineHeight;
      lineCount++;
    }

    if (collaborators.length > maxLines) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${collaborators.length - maxLines} más`, x + width / 2, y + height - 12);
    }
  }

  async function drawModernFooter(ctx, config) {
    const footerY = config.height - 80;
    const footerHeight = 60;
    
    drawGlassCard(ctx, config.padding, footerY, config.width - (config.padding * 2), footerHeight, 16);
    ctx.fillStyle = config.colors.cardBackground;
    ctx.fill();
    ctx.strokeStyle = config.colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = config.colors.textSecondary;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const footerText = 'Sistema de Gestión de Rotaciones • Edwards CR';
    ctx.fillText(footerText, config.width / 2, footerY + 25);
    
    ctx.fillStyle = config.colors.textMuted;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const authorText = 'Creado por José Ismael Morales Uriarte';
    ctx.fillText(authorText, config.width / 2, footerY + 45);
  }

  function drawGlassCard(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function drawModernPill(ctx, x, y, text, bgColor, textColor) {
    const padding = 10;
    const height = 22;
    
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const pillWidth = textWidth + (padding * 2);
    
    drawGlassCard(ctx, x, y, pillWidth, height, 11);
    ctx.fillStyle = bgColor;
    ctx.fill();
    
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + pillWidth / 2, y + height / 2);
    
    return pillWidth;
  }

  function drawCountBadge(ctx, config, current, required, x, y) {
    const size = 24;
    const isComplete = current >= required;
    
    drawGlassCard(ctx, x, y, size, size, 12);
    ctx.fillStyle = isComplete ? 'rgba(46, 204, 113, 0.9)' : 'rgba(241, 196, 15, 0.9)';
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(current.toString(), x + size / 2, y + size / 2);
  }

  function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    
    const ellipsis = '...';
    let truncated = text;
    
    while (ctx.measureText(truncated + ellipsis).width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    
    return truncated + ellipsis;
  }

  async function downloadCanvasAsImage(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `rotacion_${rotationNumber}_${formatDateForFilename(currentWeekDates.monday)}.png`;
        link.href = url;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png', 0.9);
    });
  }

  function formatDateForFilename(date) {
    if (!date || !(date instanceof Date)) {
      return 'fecha_invalida';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  // ==================== MODAL DE ASIGNACIÓN MANUAL ====================
  
  function openAssignmentModal(roleName, dayId) {
    selectedRole = roles.find(r => r.name === roleName);
    selectedDay = weekdays.find(d => d.id === dayId);
    
    if (selectedRole && selectedDay) {
      currentlyAssigned = [];
      if (assignments[dayId] && 
          assignments[dayId][roleName] && 
          Array.isArray(assignments[dayId][roleName])) {
        currentlyAssigned = [...assignments[dayId][roleName]];
      }
      
      const availableCollabs = collaborators.filter(c => {
        const canCover = c.certifications?.includes(selectedRole.name);
        const isAvailable = !(c.unavailableDays?.[selectedDay.id]);
        return canCover && isAvailable;
      });
      
      const sortedFilteredCollabs = availableCollabs.sort((a, b) => {
        const isAssignedA = currentlyAssigned.includes(a.name);
        const isAssignedB = currentlyAssigned.includes(b.name);
        
        if (isAssignedA !== isAssignedB) {
          return isAssignedA ? 1 : -1;
        }
        
        return a.name.localeCompare(b.name);
      });
      
      filteredCollaborators = sortedFilteredCollabs;
      showAssignModal = true;
    }
  }
  
  function closeAssignModal() {
    showAssignModal = false;
    selectedRole = null;
    selectedDay = null;
    filteredCollaborators = [];
    currentlyAssigned = [];
  }
  
  function assignSelectedCollaborator(collaboratorName) {
    if (!selectedRole || !selectedDay) return;
    
    try {
      let updatedAssignments = { ...assignments };
      
      if (!updatedAssignments[selectedDay.id]) {
        updatedAssignments[selectedDay.id] = {};
      }
      
      if (!updatedAssignments[selectedDay.id][selectedRole.name] || 
          !Array.isArray(updatedAssignments[selectedDay.id][selectedRole.name])) {
        updatedAssignments[selectedDay.id][selectedRole.name] = [];
      }
      
      if (!updatedAssignments[selectedDay.id][selectedRole.name].includes(collaboratorName)) {
        const maxCollabs = getMaxAllowedForDay(selectedRole, selectedDay.id);
        const currentCount = updatedAssignments[selectedDay.id][selectedRole.name]
          .filter(item => typeof item === 'string' && !item.includes('Faltan')).length;
        
        if (currentCount >= maxCollabs) {
          showStatusMessage(`No se puede asignar más de ${maxCollabs} colaboradores a este rol`, false);
          return;
        }
        
        updatedAssignments[selectedDay.id][selectedRole.name].push(collaboratorName);
        
        assignments = updatedAssignments;
        currentlyAssigned = [...updatedAssignments[selectedDay.id][selectedRole.name]];
        saveAssignments();
        
        showStatusMessage(`Colaborador asignado correctamente`, true);
        
      } else {
        showStatusMessage('El colaborador ya está asignado', false);
      }
    } catch (error) {
      showStatusMessage('Error al asignar colaborador: ' + error.message, false);
    }
  }
  
  function removeSelectedCollaborator(collaboratorName) {
    if (!selectedRole || !selectedDay) return;
    
    try {
      let updatedAssignments = { ...assignments };
      
      if (updatedAssignments[selectedDay.id]?.[selectedRole.name]?.includes(collaboratorName)) {
        updatedAssignments[selectedDay.id][selectedRole.name] = 
          updatedAssignments[selectedDay.id][selectedRole.name]
            .filter(name => name !== collaboratorName);
        
        assignments = updatedAssignments;
        currentlyAssigned = [...updatedAssignments[selectedDay.id][selectedRole.name]];
        saveAssignments();
        
        showStatusMessage('Colaborador eliminado correctamente', true);
      }
    } catch (error) {
      showStatusMessage('Error al quitar colaborador: ' + error.message, false);
    }
  }

  // ==================== UTILIDADES DE UI ====================

  function showStatusMessage(message, success = true) {
    statusMessage = message;
    isSuccess = success;
    showMessage = true;
    
    setTimeout(() => {
      showMessage = false;
    }, 5000);
  }
  
  function formatAssignments(assignments) {
    if (!assignments) return "";
    
    if (typeof assignments === "string") {
      return assignments;
    }
    
    if (Array.isArray(assignments)) {
      return assignments.join(", ");
    }
    
    return String(assignments);
  }
  
  function isRoleExcludedForDay(role, dayId) {
    try {
      if (!role || !dayId) return false;
      return role?.excludedDays?.[dayId] === true;
    } catch (error) {
      return false;
    }
  }

  function getMaxAllowedForDay(role, dayId) {
    try {
      if (!role) return 5;
      
      if (role.dailyMaxCollabs && typeof role.dailyMaxCollabs === 'object') {
        if (role.dailyMaxCollabs[dayId] !== undefined) {
          return Math.max(1, role.dailyMaxCollabs[dayId]);
        }
      }
      
      return Math.max(1, role.max || 5);
    } catch (error) {
      return 5;
    }
  }

  function clearRotation() {
    if (confirm(`¿Estás seguro de que deseas limpiar la Rotación #${rotationNumber}? Esta acción no se puede deshacer.`)) {
      const emptyAssignments = {};
      weekdays.forEach(day => {
        emptyAssignments[day.id] = {};
      });
      assignments = emptyAssignments;
      saveAssignments();
      showStatusMessage(`Rotación #${rotationNumber} limpiada correctamente`, true);
    }
  }

  function hasAnyAssignments() {
    try {
      return weekdays.some(day => {
        const dayAssignments = assignments[day.id];
        return dayAssignments && Object.keys(dayAssignments).length > 0 && 
               Object.values(dayAssignments).some(assignment => 
                 Array.isArray(assignment) && assignment.length > 0
               );
      });
    } catch (error) {
      return false;
    }
  }

  function getTotalAssignments() {
    try {
      let total = 0;
      weekdays.forEach(day => {
        const dayAssignments = assignments[day.id];
        if (dayAssignments) {
          Object.values(dayAssignments).forEach(assignment => {
            if (Array.isArray(assignment)) {
              total += assignment.filter(item => 
                typeof item === 'string' && !item.includes('Faltan')
              ).length;
            }
          });
        }
      });
      return total;
    } catch (error) {
      console.error('Error calculando asignaciones totales:', error);
      return 0;
    }
  }

  async function loadData() {
    try {
      isLoading = true;
      await loadAllData();
      showStatusMessage('Datos actualizados correctamente', true);
    } catch (error) {
      console.error('❌ Error recargando datos:', error);
      showStatusMessage('Error al actualizar datos', false);
    } finally {
      isLoading = false;
    }
  }

  // ==================== ANÁLISIS BÁSICO ====================

  function showConsecutiveReport() {
    if (!hasAnyAssignments()) {
      showStatusMessage('No hay asignaciones para analizar', false);
      return;
    }
    
    const analysis = analyzeConsecutivePatterns();
    
    if (analysis.totalConsecutives === 0) {
      showStatusMessage('¡Excelente! No hay días consecutivos detectados', true);
    } else {
      showStatusMessage(`Se detectaron ${analysis.totalConsecutives} días consecutivos.`, false);
    }
  }

  function analyzeConsecutivePatterns() {
    const analysis = {
      consecutivesByCollaborator: new Map(),
      totalConsecutives: 0
    };
    
    const weekdays_array = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    const collaboratorSchedule = new Map();
    
    weekdays_array.forEach((dayId, dayIndex) => {
      const dayAssignments = assignments[dayId] || {};
      
      Object.entries(dayAssignments).forEach(([roleName, assignedCollabs]) => {
        if (Array.isArray(assignedCollabs)) {
          assignedCollabs.forEach(collabName => {
            if (!collaboratorSchedule.has(collabName)) {
              collaboratorSchedule.set(collabName, new Array(5).fill(null));
            }
            
            const schedule = collaboratorSchedule.get(collabName);
            if (schedule[dayIndex] === null) {
              schedule[dayIndex] = [];
            }
            schedule[dayIndex].push(roleName);
          });
        }
      });
    });
    
    collaboratorSchedule.forEach((schedule, collabName) => {
      const consecutives = [];
      
      for (let day = 0; day < schedule.length - 1; day++) {
        const todayRoles = schedule[day] || [];
        const tomorrowRoles = schedule[day + 1] || [];
        
        todayRoles.forEach(role => {
          if (tomorrowRoles.includes(role)) {
            consecutives.push({
              role,
              days: [weekdays_array[day], weekdays_array[day + 1]]
            });
            analysis.totalConsecutives++;
          }
        });
      }
      
      analysis.consecutivesByCollaborator.set(collabName, {
        count: consecutives.length,
        details: consecutives
      });
    });
    
    return analysis;
  }

  function analyzeRotationQuality() {
    if (!hasAnyAssignments()) {
      showStatusMessage('No hay asignaciones para analizar', false);
      return;
    }

    const analysis = performAdvancedAnalysis();
    displayAnalysisResults(analysis);
  }

  function performAdvancedAnalysis() {
    const analysis = {
      totalAssignments: 0,
      collaboratorStats: new Map(),
      consecutiveIssues: [],
      roleRepetitionIssues: [], // NUEVO: Análisis de repetición de roles
      recommendations: []
    };

    // Crear tracker para análisis mejorado
    const tracker = new EnhancedConsecutiveTracker();
    tracker.initializeFromExistingAssignments(assignments);

    collaborators.forEach(collab => {
      const stats = analyzeCollaboratorInRotation(collab.name, tracker);
      analysis.collaboratorStats.set(collab.name, stats);
      analysis.totalAssignments += stats.totalAssignments;
    });

    analysis.consecutiveIssues = detectConsecutiveIssues();
    analysis.roleRepetitionIssues = detectRoleRepetitionIssues(tracker); // NUEVO
    analysis.recommendations = generateRecommendations(analysis);

    return analysis;
  }

  function analyzeCollaboratorInRotation(collaboratorName, tracker) {
    const stats = {
      totalAssignments: 0,
      rolesAssigned: new Set(),
      consecutiveDays: 0,
      roleRepetitions: 0, // NUEVO: Contar repeticiones de roles
      diversityScore: 0 // NUEVO: Puntuación de diversidad
    };

    const weeklyRoles = tracker.getWeeklyRoles(collaboratorName);
    const schedule = getCollaboratorSchedule(collaboratorName, assignments);
    
    stats.totalAssignments = schedule.flat().length;
    stats.rolesAssigned = weeklyRoles;
    
    // NUEVO: Calcular repeticiones de roles
    if (stats.totalAssignments > weeklyRoles.size) {
      stats.roleRepetitions = stats.totalAssignments - weeklyRoles.size;
    }
    
    // NUEVO: Calcular puntuación de diversidad (porcentaje de roles únicos)
    if (stats.totalAssignments > 0) {
      stats.diversityScore = (weeklyRoles.size / stats.totalAssignments) * 100;
    }

    return stats;
  }

  function detectRoleRepetitionIssues(tracker) {
    const issues = [];
    
    collaborators.forEach(collab => {
      const weeklyRoles = tracker.getWeeklyRoles(collab.name);
      const schedule = getCollaboratorSchedule(collab.name, assignments);
      const totalAssignments = schedule.flat().length;
      
      if (totalAssignments > weeklyRoles.size) {
        const repetitions = totalAssignments - weeklyRoles.size;
        issues.push({
          collaborator: collab.name,
          repetitions: repetitions,
          totalAssignments: totalAssignments,
          uniqueRoles: weeklyRoles.size,
          severity: repetitions > 2 ? 'high' : repetitions > 1 ? 'medium' : 'low'
        });
      }
    });
    
    return issues;
  }

  function detectConsecutiveIssues() {
    const issues = [];
    
    collaborators.forEach(collab => {
      const schedule = getCollaboratorSchedule(collab.name, assignments);
      
      for (let day = 0; day < schedule.length - 1; day++) {
        const todayRoles = schedule[day];
        const tomorrowRoles = schedule[day + 1];
        
        const repeatedRoles = todayRoles.filter(role => tomorrowRoles.includes(role));
        
        if (repeatedRoles.length > 0) {
          issues.push({
            collaborator: collab.name,
            days: [weekdays[day].name, weekdays[day + 1].name],
            roles: repeatedRoles,
            severity: repeatedRoles.length > 1 ? 'high' : 'medium'
          });
        }
      }
    });
    
    return issues;
  }

  function generateRecommendations(analysis) {
    const recommendations = [];
    
    // Recomendaciones para días consecutivos
    if (analysis.consecutiveIssues.length > 0) {
      const highSeverityIssues = analysis.consecutiveIssues.filter(issue => issue.severity === 'high');
      if (highSeverityIssues.length > 0) {
        recommendations.push({
          type: 'consecutive',
          priority: 'high',
          message: `${highSeverityIssues.length} colaboradores con múltiples días consecutivos.`,
          action: 'Revisar asignaciones manualmente'
        });
      }
    }
    
    // NUEVO: Recomendaciones para repetición de roles
    if (analysis.roleRepetitionIssues.length > 0) {
      const totalRepetitions = analysis.roleRepetitionIssues.reduce((sum, issue) => sum + issue.repetitions, 0);
      const highRepetitionIssues = analysis.roleRepetitionIssues.filter(issue => issue.severity === 'high');
      
      if (highRepetitionIssues.length > 0) {
        recommendations.push({
          type: 'roleRepetition',
          priority: 'medium',
          message: `${highRepetitionIssues.length} colaboradores repiten roles múltiples veces (${totalRepetitions} repeticiones totales).`,
          action: 'Regenerar rotación para mejor distribución'
        });
      }
    }
    
    // NUEVO: Recomendaciones para diversidad
    const diversityStats = [];
    for (const [collaborator, stats] of analysis.collaboratorStats) {
      if (stats.diversityScore < 50 && stats.totalAssignments > 2) {
        diversityStats.push({ collaborator, score: stats.diversityScore });
      }
    }
    
    if (diversityStats.length > 0) {
      recommendations.push({
        type: 'diversity',
        priority: 'low',
        message: `${diversityStats.length} colaboradores con baja diversidad de roles.`,
        action: 'Considerar redistribuir para mayor variedad'
      });
    }
    
    return recommendations;
  }

  function displayAnalysisResults(analysis) {
    let message = `Análisis de Rotación #${rotationNumber}:\n\n`;
    
    message += `📊 Resumen:\n`;
    message += `• Total asignaciones: ${analysis.totalAssignments}\n`;
    message += `• Días consecutivos: ${analysis.consecutiveIssues.length} problemas\n`;
    
    // NUEVO: Mostrar estadísticas de repetición de roles
    if (analysis.roleRepetitionIssues && analysis.roleRepetitionIssues.length > 0) {
      const totalRepetitions = analysis.roleRepetitionIssues.reduce((sum, issue) => sum + issue.repetitions, 0);
      message += `• Repeticiones de roles: ${totalRepetitions} casos\n`;
      
      // Mostrar colaboradores sin repetir roles
      const perfectDiversityCount = analysis.collaboratorStats.size - analysis.roleRepetitionIssues.length;
      message += `• Colaboradores sin repetir: ${perfectDiversityCount}/${analysis.collaboratorStats.size}\n`;
    }
    
    message += `\n`;
    
    if (analysis.recommendations.length > 0) {
      message += `💡 Recomendaciones:\n`;
      analysis.recommendations.forEach(rec => {
        const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        message += `${priorityIcon} ${rec.message}\n`;
      });
    } else {
      message += `✅ ¡Rotación bien optimizada!`;
    }
    
    showStatusMessage(message, analysis.recommendations.length === 0);
  }

  // ==================== FUNCIÓN DE DEBUG (OPCIONAL) ====================
  
  function debugCurrentState() {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.group('🔍 Estado Actual de la Rotación');
      
      console.log('📅 Información de la Rotación:', {
        number: rotationNumber,
        dates: currentWeekDates,
        firstRotation: firstRotationDate
      });
      
      console.log('👥 Colaboradores:', collaborators.length);
      console.log('🎭 Roles:', roles.length);
      console.log('🔗 Roles agrupados:', roleColorGroups);
      
      console.log('📋 Asignaciones actuales:', assignments);
      
      if (hasAnyAssignments()) {
        const tracker = new EnhancedConsecutiveTracker();
        tracker.initializeFromExistingAssignments(assignments);
        const diversityStats = tracker.getWeeklyDiversityStats();
        
        console.log('📊 Estadísticas de diversidad:', diversityStats);
        
        const evaluation = evaluateAssignmentQualityEnhanced(assignments);
        console.log('🎯 Evaluación de calidad:', evaluation);
      }
      
      console.groupEnd();
    }
  }

  // ==================== REACTIVIDAD DE SVELTE ====================

  $: if (mounted && assignments) {
    saveAssignments();
  }

  $: if (mounted && roles.length > 0) {
    // Recargar grupos de colores cuando cambien los roles
    loadAllData();
  }
</script>

<section class="section-container rotation-section">
  <h2>Gestión de Rotación</h2>
  
  <div class="content">
    <!-- Header de Rotación con Estado Dinámico -->
    <div class="rotation-header {getRotationStatusInfo().isCurrentWeek ? 'current-week' : getRotationStatusInfo().isFutureWeek ? 'future-week' : 'past-week'}">
      <div class="rotation-navigation">
        <button 
          class="nav-button" 
          on:click={goToPreviousRotation} 
          disabled={rotationNumber <= 1} 
          title="Rotación anterior"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        
        <div class="rotation-title-container">
          <h3 class="rotation-title desktop-title">{generateRotationTitle()}</h3>
          <h3 class="rotation-title mobile-title">{generateShortRotationTitle()}</h3>
          
          <div class="rotation-info">
            <div class="week-status-container">
              <span class="week-indicator">Rotación #{rotationNumber}</span>
              <span class="week-status {getRotationStatusInfo().isCurrentWeek ? 'current' : getRotationStatusInfo().isFutureWeek ? 'future' : 'past'}">
                {getRotationStatusInfo().statusText}
              </span>
            </div>
            
            {#if currentWeekDates && currentWeekDates.monday && currentWeekDates.friday}
              <span class="date-range">
                {formatDate(currentWeekDates.monday)} - {formatDate(currentWeekDates.friday)}
              </span>
            {/if}
            
            <!-- Información adicional si es la primera rotación -->
            {#if rotationNumber === 1 && !firstRotationDate}
              <div class="first-rotation-notice">
                <span class="notice-icon">🆕</span>
                <span class="notice-text">Primera rotación - Genere para establecer el calendario</span>
              </div>
            {/if}
            
            <!-- Mostrar total de rotaciones si hay historial -->
            {#if firstRotationDate}
              <div class="rotation-history-info">
                <span class="history-icon">📅</span>
                <span class="history-text">
                  Iniciado el {formatDate(firstRotationDate)}
                </span>
              </div>
            {/if}
          </div>
        </div>
        
        <button 
          class="nav-button" 
          on:click={advanceToNextRotation} 
          title="Siguiente rotación"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      
      <!-- Progreso semanal mejorado -->
      <div class="week-progress">
        {#if getRotationStatusInfo().isCurrentWeek}
          <div class="progress-bar">
            <div 
              class="progress-fill current-week-progress" 
              style="width: {((new Date().getDay() || 7) / 7) * 100}%"
            ></div>
          </div>
          <span class="progress-text">Progreso de la semana actual</span>
        {:else if getRotationStatusInfo().isFutureWeek}
          <div class="progress-bar">
            <div class="progress-fill future-week-progress" style="width: 0%"></div>
          </div>
          <span class="progress-text">Semana futura - Aún no iniciada</span>
        {:else}
          <div class="progress-bar">
            <div class="progress-fill past-week-progress" style="width: 100%"></div>
          </div>
          <span class="progress-text">Semana completada</span>
        {/if}
      </div>
      
      <!-- Indicadores de estado -->
      <div class="rotation-indicators">
        {#if !firstRotationDate}
          <div class="indicator setup">
            <span class="indicator-icon">⚙️</span>
            <span class="indicator-text">Configuración inicial</span>
          </div>
        {/if}
        
        {#if hasAnyAssignments()}
          <div class="indicator has-assignments">
            <span class="indicator-icon">✅</span>
            <span class="indicator-text">{getTotalAssignments()} asignaciones realizadas</span>
          </div>
        {:else}
          <div class="indicator no-assignments">
            <span class="indicator-icon">⚪</span>
            <span class="indicator-text">Sin asignaciones</span>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Mensajes de estado -->
    {#if showMessage}
      <div class="status-message {isSuccess ? 'success' : 'error'}">
        {statusMessage}
        <button class="close-message" on:click={() => showMessage = false}>×</button>
      </div>
    {/if}
    
    <!-- Tabla de rotación -->
    <div class="rotation-table-container">
      {#if isLoading}
        <div class="loading-overlay">
          <div class="spinner"></div>
          <div class="loading-info">
            <p>Generando rotación...</p>
            {#if generationStep}
              <span class="loading-step">{generationStep}</span>
            {/if}
            {#if generationProgress > 0}
              <div class="progress-bar-loading">
                <div class="progress-fill-loading" style="width: {generationProgress}%"></div>
              </div>
              <span class="progress-percentage">{Math.round(generationProgress)}%</span>
            {/if}
          </div>
        </div>
      {/if}
      
      <table class="rotation-table">
        <thead>
          <tr>
            <th class="role-header">Roles</th>
            {#each weekdays as day}
              <th>{day.name}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#if roles && roles.length > 0}
            {#each roles as role (role.id || role.name)}
              <tr>
                <td class="role-cell">
                  <div class="role-info">
                    <span class="role-name">{role.name}</span>
                    {#if role.priority === 2}
                      <span class="priority-badge">Prioridad Baja</span>
                    {/if}
                    <div class="role-requirements">
                      <span class="req-min">Mín: {role.min || 1}</span>
                      <span class="req-max">Máx: {role.max || 5}</span>
                    </div>
                  </div>
                </td>
                {#each weekdays as day (day.id)}
                  <td class="assignment-cell">
                    {#if isRoleExcludedForDay(role, day.id)}
                      <div class="role-excluded">
                        <span class="excluded-icon">🚫</span>
                        <span class="excluded-text">No requerido</span>
                      </div>
                    {:else if assignments && assignments[day.id] && assignments[day.id][role.name]}
                      <div 
                        class="assignment-button assigned {typeof assignments[day.id][role.name] === 'string' && assignments[day.id][role.name].includes('Sin') ? 'warning' : ''} 
                        {typeof assignments[day.id][role.name] === 'string' && assignments[day.id][role.name].includes('Faltan') ? 'incomplete' : ''}
                        {typeof assignments[day.id][role.name] === 'string' && assignments[day.id][role.name].includes('Omitido') ? 'omitted' : ''}"
                        on:click={() => openAssignmentModal(role.name, day.id)}
                        title="Clic para editar asignaciones"
                      >
                        <div class="assignment-content">
                          <span class="assignment-text">{formatAssignments(assignments[day.id][role.name])}</span>
                        </div>
                      </div>
                    {:else}
                      <button 
                        class="assignment-button empty" 
                        on:click={() => openAssignmentModal(role.name, day.id)}
                        title="Clic para asignar colaboradores"
                      >
                        <span class="button-placeholder">
                          <span class="plus-icon">+</span>
                          Asignar
                        </span>
                      </button>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="6" class="no-data">
                <div class="no-data-content">
                  <span class="no-data-icon">📋</span>
                  <span class="no-data-text">No hay roles configurados</span>
                  <span class="no-data-hint">Por favor, agregue roles primero en la sección de Gestión de Roles</span>
                </div>
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
    
    <!-- Información de estado mejorada -->
    <div class="data-status">
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">Roles disponibles:</span>
          <span class="status-value">{roles ? roles.length : 0}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Colaboradores:</span>
          <span class="status-value">{collaborators ? collaborators.length : 0}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Roles compartidos:</span>
          <span class="status-value">{rolesToCover ? rolesToCover.length : 0}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Total asignaciones:</span>
          <span class="status-value">{getTotalAssignments()}</span>
        </div>
        {#if firstRotationDate}
          <div class="status-item">
            <span class="status-label">Desde:</span>
            <span class="status-value">{formatDate(firstRotationDate)}</span>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Acciones mejoradas con botón de exportar imagen -->
    <div class="rotation-actions">
      <button 
        class="action-button refresh-button" 
        on:click={loadData} 
        disabled={isLoading}
        title="Actualizar datos desde la base de datos"
      >
        <span class="button-icon">🔄</span> 
        <span class="button-text">Actualizar</span>
      </button>
      
      <button 
        class="action-button generate-button" 
        on:click={generateRotation} 
        disabled={isLoading || !roles.length || !collaborators.length}
        title="{!firstRotationDate ? 'Generar primera rotación y establecer calendario' : 'Generar nueva rotación automáticamente'}"
      >
        <span class="button-icon">{!firstRotationDate ? '🎯' : '✨'}</span> 
        <span class="button-text">{!firstRotationDate ? 'Iniciar Sistema' : 'Generar Rotación'}</span>
      </button>
      
      <!-- NUEVO BOTÓN DE EXPORTAR IMAGEN -->
      <button 
        class="action-button export-button" 
        on:click={exportRotationAsImage} 
        disabled={isLoading || !hasAnyAssignments()}
        title="Descargar calendario de rotación como imagen PNG compacta"
      >
        <span class="button-icon">📸</span> 
        <span class="button-text">Exportar Imagen</span>
      </button>
      
      <button 
        class="action-button clear-button" 
        on:click={clearRotation} 
        disabled={isLoading || !hasAnyAssignments()}
        title="Limpiar todas las asignaciones de esta rotación"
      >
        <span class="button-icon">🧹</span> 
        <span class="button-text">Limpiar</span>
      </button>
      
      {#if hasAnyAssignments()}
        <button 
          class="action-button stats-button" 
          on:click={showConsecutiveReport} 
          disabled={isLoading}
          title="Mostrar análisis de días consecutivos"
        >
          <span class="button-icon">📊</span> 
          <span class="button-text">Análisis</span>
        </button>
        
        <!-- NUEVO BOTÓN DE ANÁLISIS AVANZADO -->
        <button 
          class="action-button analysis-button" 
          on:click={analyzeRotationQuality} 
          disabled={isLoading}
          title="Análisis completo de calidad de la rotación"
        >
          <span class="button-icon">🔬</span> 
          <span class="button-text">Análisis Avanzado</span>
        </button>
      {/if}
      
      <!-- Botón de debug (solo en desarrollo) -->
      {#if typeof window !== 'undefined' && window.location.hostname === 'localhost'}
        <button 
          class="action-button debug-button" 
          on:click={debugCurrentState}
          title="Mostrar información de depuración en consola"
        >
          <span class="button-icon">🔍</span> 
          <span class="button-text">Debug</span>
        </button>
      {/if}
    </div>
  </div>
  
  <!-- Modal para asignar colaboradores -->
  {#if showAssignModal}
    <div class="modal-backdrop" on:click={closeAssignModal}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h3>
            <span class="modal-icon">👥</span>
            Asignar Colaborador
            {#if selectedRole && selectedDay}
              <span class="modal-subtitle">para {selectedRole.name} el {selectedDay.name}</span>
            {/if}
          </h3>
          <button class="modal-close" on:click={closeAssignModal}>×</button>
        </div>
        
        <div class="modal-body">
          <!-- Información del rol y contexto de rotación -->
          {#if selectedRole}
            <div class="role-requirements-info">
              <div class="role-context">
                <h4>Información del Rol</h4>
                <div class="context-details">
                  <span class="context-item">
                    <span class="context-label">Rotación:</span>
                    <span class="context-value">#{rotationNumber}</span>
                  </span>
                  <span class="context-item">
                    <span class="context-label">Estado:</span>
                    <span class="context-value">{getRotationStatusInfo().statusText}</span>
                  </span>
                </div>
              </div>
              
              <div class="requirements-grid">
                <div class="req-item">
                  <span class="req-label">Mínimo:</span>
                  <span class="req-value">{selectedRole.min || 1}</span>
                </div>
                <div class="req-item">
                  <span class="req-label">Máximo:</span>
                  <span class="req-value">{getMaxAllowedForDay(selectedRole, selectedDay?.id)}</span>
                </div>
                <div class="req-item">
                  <span class="req-label">Actual:</span>
                  <span class="req-value current">{currentlyAssigned ? currentlyAssigned.length : 0}</span>
                </div>
                <div class="req-item">
                  <span class="req-label">Faltantes:</span>
                  <span class="req-value needed">
                    {Math.max(0, (selectedRole.min || 1) - (currentlyAssigned ? currentlyAssigned.length : 0))}
                  </span>
                </div>
              </div>
            </div>
          {/if}

          <!-- Colaboradores ya asignados -->
          {#if currentlyAssigned && currentlyAssigned.length > 0}
            <div class="currently-assigned">
              <h4>
                <span class="section-icon">✅</span>
                Colaboradores asignados ({currentlyAssigned.length}):
              </h4>
              <div class="assigned-list">
                {#each currentlyAssigned as collaboratorName}
                  <div class="assigned-collaborator">
                    <span class="collaborator-name">{collaboratorName}</span>
                    <button 
                      class="remove-button" 
                      on:click={() => removeSelectedCollaborator(collaboratorName)}
                      title="Quitar de la asignación"
                    >
                      <span class="remove-icon">×</span>
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
 
          <!-- Lista de colaboradores disponibles -->
          {#if filteredCollaborators && filteredCollaborators.length > 0}
            <div class="collaborators-list">
              <h4>
                <span class="section-icon">👤</span>
                Colaboradores disponibles ({filteredCollaborators.length}):
              </h4>
              <div class="collaborators-grid">
                {#each filteredCollaborators as collaborator}
                  <div 
                    class="collaborator-item {currentlyAssigned && currentlyAssigned.includes(collaborator.name) ? 'already-assigned' : 'available'}" 
                    on:click={() => assignSelectedCollaborator(collaborator.name)}
                    title="{currentlyAssigned && currentlyAssigned.includes(collaborator.name) ? 'Ya asignado' : 'Clic para asignar'}"
                  >
                    <div class="collaborator-info">
                      <div class="collaborator-name">{collaborator.name}</div>
                      <div class="collaborator-certifications">
                        <span class="cert-count">{collaborator.certifications ? collaborator.certifications.length : 0}</span>
                        <span class="cert-label">certificaciones</span>
                      </div>
                      
                      <!-- Indicador de disponibilidad especial -->
                      {#if collaborator.unavailableDays && Object.values(collaborator.unavailableDays).some(day => day)}
                        <div class="availability-warning">
                          <span class="warning-icon">⚠️</span>
                          <span class="warning-text">Disponibilidad limitada</span>
                        </div>
                      {/if}
                      
                      {#if currentlyAssigned && currentlyAssigned.includes(collaborator.name)}
                        <div class="assigned-indicator">
                          <span class="assigned-icon">✓</span>
                          <span class="assigned-text">Asignado</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="no-data">
              <div class="no-data-content">
                <span class="no-data-icon">😔</span>
                <span class="no-data-text">No hay colaboradores disponibles</span>
                <span class="no-data-hint">
                  No hay colaboradores que puedan cubrir este rol en este día.
                  Verifique las certificaciones y disponibilidad.
                </span>
              </div>
            </div>
          {/if}
        </div>
        
        <div class="modal-footer">
          <div class="modal-info">
            <span class="info-text">
              {#if selectedRole && selectedDay}
                Rotación #{rotationNumber} • {selectedRole.name} • {selectedDay.name}
              {/if}
            </span>
          </div>
          <div class="modal-actions">
            <button class="cancel-button" on:click={closeAssignModal}>
              <span class="button-icon">❌</span>
              <span class="button-text">Cerrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>