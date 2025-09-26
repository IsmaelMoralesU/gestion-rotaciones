<script>
  import '../../lib/styles/management.css';
  import { onMount, onDestroy } from 'svelte';
  import { db } from '../../lib/services/DatabaseService.js';
  import '../../lib/styles/roles.css'; //  Importar estilos específicos

  
  // Estado para el formulario
  let roleName = "";
  let minCollaborators = 1;
  let maxCollaborators = 1; // Cambiado de 5 a 1 por defecto
  let priority = 1; // Prioridad del rol, por defecto 1 (alta prioridad)
  let roles = [];
  let editingIndex = -1;
  let formError = "";
  let mounted = false;
  
  // Estado para roles a cubrir
  let selectedRolesToCover = [];
  
  // **NUEVO: Sistema simple de grupos por colores**
  let selectedColorGroup = 'blue'; // ✅ Azul seleccionado por defecto
  let roleColorGroups = {
    blue: [],
    orange: [],
    green: []
  };
  
  // Colores disponibles
  const colorGroups = [
    { id: 'blue', name: 'Grupo Azul', color: '#3498db', bgColor: 'rgba(52, 152, 219, 0.2)' },
    { id: 'orange', name: 'Grupo Naranja', color: '#f39c12', bgColor: 'rgba(243, 156, 18, 0.2)' },
    { id: 'green', name: 'Grupo Verde', color: '#2ecc71', bgColor: 'rgba(46, 204, 113, 0.2)' }
  ];
  
  // Estado para días NO requeridos (días excluidos)
  let excludedDays = {
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false
  };
  
  // Estado para máximos por día
  let dailyMaxCollabs = {
    monday: 1,
    tuesday: 1,
    wednesday: 1,
    thursday: 1,
    friday: 1
  };
  
  // Modal para editar días excluidos
  let showDaysModal = false;
  let editingDaysForIndex = -1;
  let tempExcludedDays = { ...excludedDays };
  
  // Modal para editar máximos por día
  let showDailyMaxModal = false;
  let editingMaxForIndex = -1;
  let tempDailyMaxCollabs = { ...dailyMaxCollabs };
  
  // Modal para editar roles
  let showEditModal = false;
  let editingRoleData = {
    name: "",
    min: 1,
    max: 1,
    priority: 1,
    dailyMaxCollabs: { ...dailyMaxCollabs }
  };
  
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
  let unsubscribeCoverage = null;
  
  // ==================== INICIALIZACIÓN Y CARGA DE DATOS ====================
  
  onMount(async () => {
    try {
      console.log('🚀 Inicializando RolesManagement...');
      
      // 1. Inicializar servicio unificado
      await db.init();
      console.log('✅ Servicio de base de datos inicializado');
      
      // 2. Cargar todos los datos
      await loadAllData();
      
      // 3. Suscribirse a cambios automáticos
      unsubscribeRoles = db.subscribe('roles', handleRoleChanges);
      unsubscribeCoverage = db.subscribe('coverage', handleCoverageChanges);
      
      console.log('✅ Suscripciones configuradas');
      
      // 4. Marcar como montado
      mounted = true;
      console.log('✅ RolesManagement inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando RolesManagement:', error);
      // Fallback completo a localStorage
      await loadFromLocalStorageFallback();
      mounted = true;
    }
  });
  
  // Cleanup al desmontar
  onDestroy(() => {
    if (unsubscribeRoles) unsubscribeRoles();
    if (unsubscribeCoverage) unsubscribeCoverage();
  });
  
  // ==================== FUNCIONES DE CARGA DE DATOS ====================
  
  async function loadAllData() {
    try {
      console.log('📖 Cargando datos desde servicio...');
      
      // Cargar roles
      const loadedRoles = await db.getAll('roles');
      roles = (loadedRoles || []).map(normalizeRole);
      console.log(`✅ ${roles.length} roles cargados`);
      
      // Cargar cobertura (roles compartidos) - LEGACY para compatibilidad
      const coverageData = await db.getById('coverage', 1);
      selectedRolesToCover = coverageData?.roleNames || [];
      
      // NUEVO: Cargar grupos por colores
      await loadColorGroups();
      
      console.log(`✅ ${selectedRolesToCover.length} roles compartidos cargados (legacy)`);
      
    } catch (error) {
      console.error('❌ Error cargando datos desde servicio:', error);
      await loadFromLocalStorageFallback();
    }
  }

  // NUEVO: Función para cargar grupos por colores
  async function loadColorGroups() {
    try {
      const colorGroupsData = await db.getById('colorGroups', 1);
      roleColorGroups = colorGroupsData?.groups || {
        blue: [],
        orange: [],
        green: []
      };
      console.log('✅ Grupos por colores cargados:', roleColorGroups);
    } catch (error) {
      console.error('❌ Error cargando grupos por colores:', error);
      // Fallback a localStorage
      const savedColorGroups = localStorage.getItem('gestionRotaciones_colorGroups');
      if (savedColorGroups) {
        roleColorGroups = JSON.parse(savedColorGroups);
      }
    }
  }
  
  // Función de respaldo para cargar desde localStorage
  async function loadFromLocalStorageFallback() {
    console.log('📁 Usando fallback a localStorage...');
    
    try {
      // Cargar roles
      const savedRoles = localStorage.getItem('gestionRotaciones_roles');
      roles = savedRoles ? JSON.parse(savedRoles).map(normalizeRole) : [];
      
      // Cargar cobertura
      const savedCoverage = localStorage.getItem('gestionRotaciones_coverage');
      selectedRolesToCover = savedCoverage ? JSON.parse(savedCoverage) : [];

      // NUEVO: Cargar grupos por colores desde localStorage
      const savedColorGroups = localStorage.getItem('gestionRotaciones_colorGroups');
      if (savedColorGroups) {
        roleColorGroups = JSON.parse(savedColorGroups);
      }
      
      console.log('📁 Datos cargados desde localStorage');
    } catch (error) {
      console.error('❌ Error en fallback localStorage:', error);
    }
  }
  
  // Normalizar estructura de rol
  function normalizeRole(role) {
    return {
      ...role,
      excludedDays: role.excludedDays || { ...excludedDays },
      dailyMaxCollabs: role.dailyMaxCollabs || {
        monday: role.max || 1,
        tuesday: role.max || 1,
        wednesday: role.max || 1,
        thursday: role.max || 1,
        friday: role.max || 1
      },
      priority: role.priority || 1
    };
  }
  
  // ==================== FUNCIONES DE GUARDADO ====================
  
  async function saveAllData() {
    if (!mounted) return;
    
    try {
      // Guardar roles usando el servicio unificado
      await db.saveAll('roles', roles);
      console.log('✅ Roles guardados correctamente');
      
      // Guardar cobertura usando el servicio unificado
      await db.save('coverage', {
        id: 1,
        roleNames: selectedRolesToCover
      });
      
      // NUEVO: Guardar grupos por colores
      await db.save('colorGroups', {
        id: 1,
        groups: roleColorGroups
      });
      
      console.log('✅ Cobertura guardada correctamente');
      console.log('✅ Grupos por colores guardados correctamente');
      
    } catch (error) {
      console.error('❌ Error guardando datos:', error);
      // Fallback a localStorage
      saveToLocalStorageFallback();
    }
  }
  
  function saveToLocalStorageFallback() {
    try {
      localStorage.setItem('gestionRotaciones_roles', JSON.stringify(roles));
      localStorage.setItem('gestionRotaciones_coverage', JSON.stringify(selectedRolesToCover));
      
      // NUEVO: Guardar grupos por colores
      localStorage.setItem('gestionRotaciones_colorGroups', JSON.stringify(roleColorGroups));
      
      console.log('💾 Datos guardados en localStorage (fallback)');
    } catch (error) {
      console.error('❌ Error guardando en localStorage:', error);
    }
  }
  
  // ==================== REACTIVIDAD DE SVELTE ====================
  
  // Observar cambios en roles para guardar automáticamente
  $: if (mounted && roles) {
    saveAllData();
  }
  
  // Observar cambios en grupos por colores para guardar automáticamente
  $: if (mounted && roleColorGroups) {
    saveAllData();
  }
  
  // NUEVO: Observar cambios en editingRoleData.max para actualizar automáticamente los máximos por día
  $: if (showEditModal && editingRoleData.max) {
    // Solo actualizar si el valor cambió
    const currentRole = roles[editingIndex];
    if (currentRole && editingRoleData.max !== currentRole.max) {
      // Actualizar todos los días al nuevo máximo
      editingRoleData.dailyMaxCollabs = {
        monday: editingRoleData.max,
        tuesday: editingRoleData.max,
        wednesday: editingRoleData.max,
        thursday: editingRoleData.max,
        friday: editingRoleData.max
      };
    }
  }
  
  // ==================== HANDLERS DE SINCRONIZACIÓN ====================
  
  function handleRoleChanges(event) {
    // Manejar cambios externos en roles (si otro componente los modifica)
    if (event.action === 'saveAll' && event.data && mounted) {
      console.log('🔄 Roles actualizados externamente');
      // Opcional: recargar datos si fueron modificados por otro lugar
    }
  }
  
  function handleCoverageChanges(event) {
    // Manejar cambios externos en cobertura
    if (event.action === 'save' && event.data && mounted) {
      console.log('🔄 Cobertura actualizada externamente');
      // Opcional: recargar datos si fueron modificados por otro lugar
    }
  }
  
  // ==================== VALIDACIONES MEJORADAS ====================
  
  // Validación en tiempo real
  $: nameValidation = roleName.trim() ? validateRoleName(roleName) : null;
  
  // Función para validar el nombre del rol - MEJORADA
  function validateRoleName(name) {
    // Eliminar espacios solo al final (mantener espacios al inicio y en medio)
    const trimmedName = name.trimEnd();
    
    // 1. Verificar longitud mínima de 3 caracteres
    if (trimmedName.length < 3) {
      return "El nombre del rol debe tener al menos 3 caracteres";
    }
    
    // 2. Verificar que no sean tres letras iguales consecutivas
    if (/^(\w)\1{2,}$/.test(trimmedName)) {
      return "El nombre no puede ser tres letras iguales consecutivas";
    }
    
    // 3. Verificar caracteres permitidos - REGEX MEJORADA
    // Permitimos: letras (incluye acentos), números, espacios múltiples, (), -, /, _
    if (!/^[a-zA-ZáéíóúüÁÉÍÓÚÜñÑ0-9\s\(\)\-\/_]+$/.test(trimmedName)) {
      return "Solo se permiten letras, números, espacios, paréntesis (), guiones -, barras / y guiones bajos _";
    }
    
    // 4. Verificar que no termine con espacios (ya se eliminaron con trimEnd)
    if (name !== trimmedName) {
      return "El nombre no puede terminar con espacios";
    }
    
    // 5. Verificar que no esté completamente vacío después de limpiar
    if (trimmedName.trim().length === 0) {
      return "El nombre no puede estar vacío o contener solo espacios";
    }
    
    return null; // Sin errores
  }
  
  // Función para limpiar el nombre antes de guardar - MEJORADA
  function cleanRoleName(name) {
    // Solo eliminar espacios al final, mantener todo lo demás
    return name.trimEnd();
  }
  
  // Función para manejar valores mínimos y validaciones
  function validateMinMax() {
    // Asegurar que minCollaborators sea siempre al menos 1
    if (minCollaborators < 1) {
      minCollaborators = 1;
    }
    
    // Asegurar que maxCollaborators sea siempre al menos 1
    if (maxCollaborators < 1) {
      maxCollaborators = 1;
    }
    
    // Asegurar que maxCollaborators sea al menos igual a minCollaborators
    if (maxCollaborators < minCollaborators) {
      maxCollaborators = minCollaborators;
    }

    // Inicializar dailyMaxCollabs basado en el valor máximo
    Object.keys(dailyMaxCollabs).forEach(day => {
      dailyMaxCollabs[day] = maxCollaborators;
    });
  }
  
  // ==================== LÓGICA DE FORMULARIO ====================
  
  // Incrementar/decrementar con botones
  function incrementMin() {
    minCollaborators += 1;
    validateMinMax();
  }
  
  function decrementMin() {
    if (minCollaborators > 1) {
      minCollaborators -= 1;
    }
    validateMinMax();
  }
  
  function incrementMax() {
    maxCollaborators += 1;
    validateMinMax();
  }
  
  function decrementMax() {
    if (maxCollaborators > 1) {
      maxCollaborators -= 1;
    }
    validateMinMax();
  }
  
  // Función para agregar un rol - ACTUALIZADA
  function handleSubmit() {
    formError = "";
    
    // Validar nombre del rol con la nueva función
    const nameError = validateRoleName(roleName);
    if (nameError) {
      formError = nameError;
      return;
    }
    
    // Limpiar el nombre con la nueva función (solo quita espacios al final)
    const cleanedRoleName = cleanRoleName(roleName);
    
    // Validaciones para colaboradores
    validateMinMax();
    
    if (minCollaborators > maxCollaborators) {
      formError = "El mínimo no puede ser mayor que el máximo";
      return;
    }
    
    // Verificar duplicados
    const duplicateRole = roles.find((role, index) => 
      role.name.toLowerCase() === cleanedRoleName.toLowerCase() && 
      index !== editingIndex
    );
    
    if (duplicateRole) {
      formError = "Ya existe un rol con este nombre";
      return;
    }
    
    // Crear el objeto rol
    const role = {
      name: cleanedRoleName,
      min: minCollaborators,
      max: maxCollaborators,
      priority: priority,
      excludedDays: { ...excludedDays },
      dailyMaxCollabs: { ...dailyMaxCollabs }
    };
    
    // Agregar nuevo rol
    roles = [...roles, role];
    
    // Limpiar el formulario
    resetForm();
  }
  
  function resetForm() {
    roleName = "";
    minCollaborators = 1;
    maxCollaborators = 1; // Cambiado de 5 a 1
    priority = 1;
    dailyMaxCollabs = {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1,
      friday: 1
    };
  }
  
  function deleteRole(index) {
    const deletedRoleName = roles[index].name;
    
    // Eliminar el rol
    roles = roles.filter((_, i) => i !== index);
    
    // Si estamos editando este rol, limpiar el formulario
    if (editingIndex === index) {
      resetForm();
      editingIndex = -1;
    }
    
    // Actualizar roles a cubrir
    if (selectedRolesToCover.includes(deletedRoleName)) {
      selectedRolesToCover = selectedRolesToCover.filter(name => name !== deletedRoleName);
    }
    
    // NUEVO: Actualizar grupos por colores al eliminar rol
    Object.keys(roleColorGroups).forEach(color => {
      roleColorGroups[color] = roleColorGroups[color].filter(roleName => roleName !== deletedRoleName);
    });
    roleColorGroups = { ...roleColorGroups }; // Forzar reactividad
    
    // NUEVO: Notificar a otros componentes sobre la eliminación
    db.notify('roles', 'delete', {
      roleName: deletedRoleName
    });
  }
  
  // ==================== NUEVO: LÓGICA SIMPLE DE GRUPOS POR COLORES ====================
  
  // Seleccionar color de grupo - CORREGIDO para limpiar roles al deseleccionar
  function selectColorGroup(colorId) {
    if (selectedColorGroup === colorId) {
      // Si estamos deseleccionando el color actual, limpiar sus roles
      roleColorGroups[colorId] = [];
      roleColorGroups = { ...roleColorGroups }; // Forzar reactividad
      selectedColorGroup = null;
    } else {
      // Seleccionar nuevo color
      selectedColorGroup = colorId;
    }
  }
  
  // Toggle de rol en grupo de color - CORREGIDO para desmarcar roles individuales
  function toggleRoleInColorGroup(roleName) {
    if (!selectedColorGroup) return;
    
    // Si el rol ya está en el grupo seleccionado, solo quitarlo de ese grupo
    if (roleColorGroups[selectedColorGroup].includes(roleName)) {
      roleColorGroups[selectedColorGroup] = roleColorGroups[selectedColorGroup].filter(name => name !== roleName);
    } else {
      // Si el rol no está en el grupo seleccionado, quitarlo de otros grupos primero y agregarlo al actual
      Object.keys(roleColorGroups).forEach(color => {
        roleColorGroups[color] = roleColorGroups[color].filter(name => name !== roleName);
      });
      roleColorGroups[selectedColorGroup] = [...roleColorGroups[selectedColorGroup], roleName];
    }
    
    // Forzar reactividad
    roleColorGroups = { ...roleColorGroups };
  }
  
  // Obtener color de un rol
  function getRoleColor(roleName) {
    for (const [colorId, roles] of Object.entries(roleColorGroups)) {
      if (roles.includes(roleName)) {
        return colorGroups.find(c => c.id === colorId);
      }
    }
    return null;
  }
  
  // Verificar si un rol está en algún grupo
  function isRoleInAnyColorGroup(roleName) {
    return Object.values(roleColorGroups).some(roles => roles.includes(roleName));
  }
  
  // Obtener todos los roles agrupados
  function getAllColorGroupedRoles() {
    const allRoles = [];
    Object.values(roleColorGroups).forEach(roles => {
      allRoles.push(...roles);
    });
    return allRoles;
  }
  
  // IMPORTANTE: Actualizar selectedRolesToCover basado en grupos de colores
  $: {
    if (mounted) {
      selectedRolesToCover = getAllColorGroupedRoles();
    }
  }
  
  // ==================== LÓGICA DE ROLES A CUBRIR (LEGACY - MANTENER PARA COMPATIBILIDAD) ====================
  
  // Toggle de selección para roles a cubrir
  function toggleRoleCoverage(roleName) {
    if (selectedRolesToCover.includes(roleName)) {
      selectedRolesToCover = selectedRolesToCover.filter(name => name !== roleName);
    } else {
      selectedRolesToCover = [...selectedRolesToCover, roleName];
    }
  }
  
  // ==================== MODALES DE EDICIÓN ====================
  
  // Función para abrir el modal de edición
  function openEditModal(index) {
    const role = roles[index];
    editingRoleData = {
      name: role.name,
      min: role.min,
      max: role.max,
      priority: role.priority || 1,
      dailyMaxCollabs: role.dailyMaxCollabs ? { ...role.dailyMaxCollabs } : {
        monday: role.max || 1,
        tuesday: role.max || 1,
        wednesday: role.max || 1,
        thursday: role.max || 1,
        friday: role.max || 1
      }
    };
    editingIndex = index;
    showEditModal = true;
    formError = ""; // Limpiar errores previos
  }
  
  // Función para cerrar el modal de edición
  function closeEditModal() {
    showEditModal = false;
    editingIndex = -1;
    formError = ""; // Limpiar errores
  }
  
  // MODIFICADO: Función para guardar los cambios desde el modal
  function saveRoleChanges() {
    // Validar el nombre con la nueva función
    const nameError = validateRoleName(editingRoleData.name);
    if (nameError) {
      formError = nameError;
      return;
    }
    
    // Limpiar el nombre con la nueva función
    const cleanedName = cleanRoleName(editingRoleData.name);
    
    // Verificar duplicados excepto el rol actual
    const duplicateRole = roles.find((role, index) => 
      role.name.toLowerCase() === cleanedName.toLowerCase() && 
      index !== editingIndex
    );
    
    if (duplicateRole) {
      formError = "Ya existe un rol con este nombre";
      return;
    }
    
    // NUEVO: Actualizar automáticamente dailyMaxCollabs cuando cambia el máximo
    // Si el nuevo máximo es diferente al anterior, actualizar todos los días
    const currentRole = roles[editingIndex];
    if (editingRoleData.max !== currentRole.max) {
      // Actualizar todos los días al nuevo máximo
      Object.keys(editingRoleData.dailyMaxCollabs).forEach(day => {
        editingRoleData.dailyMaxCollabs[day] = editingRoleData.max;
      });
    }
    
    // Actualizar el rol
    if (editingIndex >= 0 && editingIndex < roles.length) {
      const oldRoleName = roles[editingIndex].name;
      const newRoleName = cleanedName;
      
      const updatedRole = {
        ...roles[editingIndex],
        name: newRoleName,
        min: editingRoleData.min,
        max: editingRoleData.max,
        priority: editingRoleData.priority,
        dailyMaxCollabs: { ...editingRoleData.dailyMaxCollabs }
      };
      
      // Actualizar el rol
      const updatedRoles = [...roles];
      updatedRoles[editingIndex] = updatedRole;
      roles = updatedRoles;
      
      // NUEVO: Emitir evento de cambio de nombre si el nombre cambió
      if (oldRoleName !== newRoleName) {
        // Actualizar grupos por colores
        Object.keys(roleColorGroups).forEach(color => {
          roleColorGroups[color] = roleColorGroups[color].map(roleName => 
            roleName === oldRoleName ? newRoleName : roleName
          );
        });
        roleColorGroups = { ...roleColorGroups }; // Forzar reactividad
        
        // NUEVO: Notificar a otros componentes sobre el cambio de nombre
        db.notify('roles', 'rename', {
          oldName: oldRoleName,
          newName: newRoleName
        });
      }
      
      // Cerrar modal
      closeEditModal();
    }
  }
  
  // ==================== MODAL DE DÍAS EXCLUIDOS ====================
  
  // Funciones para gestionar días excluidos
  function openDaysModal(index) {
    const role = roles[index];
    // Copiar los días excluidos actuales al estado temporal
    tempExcludedDays = { ...(role.excludedDays || excludedDays) };
    editingDaysForIndex = index;
    showDaysModal = true;
  }
  
  function closeDaysModal() {
    showDaysModal = false;
    editingDaysForIndex = -1;
    // Reiniciar estado temporal
    tempExcludedDays = { ...excludedDays };
  }
  
  function toggleDayExcluded(day) {
    tempExcludedDays = {
      ...tempExcludedDays,
      [day]: !tempExcludedDays[day]
    };
  }
  
  function saveDaysChanges() {
    if (editingDaysForIndex >= 0 && editingDaysForIndex < roles.length) {
      // Crear copia de roles para mantener la reactividad
      const updatedRoles = [...roles];
      // Actualizar los días excluidos
      updatedRoles[editingDaysForIndex].excludedDays = { ...tempExcludedDays };
      // Actualizar la lista de roles
      roles = updatedRoles;
      // Cerrar el modal
      closeDaysModal();
    }
  }

  // ==================== MODAL DE MÁXIMOS POR DÍA ====================

  // Funciones para gestionar máximos por día
  function openDailyMaxModal(index) {
    const role = roles[index];
    // Copiar los máximos actuales al estado temporal
    tempDailyMaxCollabs = { ...(role.dailyMaxCollabs || {
      monday: role.max || 1,
      tuesday: role.max || 1,
      wednesday: role.max || 1,
      thursday: role.max || 1,
      friday: role.max || 1
    }) };
    editingMaxForIndex = index;
    showDailyMaxModal = true;
  }
  
  function closeDailyMaxModal() {
    showDailyMaxModal = false;
    editingMaxForIndex = -1;
    // Reiniciar estado temporal
    tempDailyMaxCollabs = { ...dailyMaxCollabs };
  }

  // Incrementar máximo para un día específico
  function incrementDailyMax(day) {
    tempDailyMaxCollabs = {
      ...tempDailyMaxCollabs,
      [day]: tempDailyMaxCollabs[day] + 1
    };
  }

  // Decrementar máximo para un día específico
  function decrementDailyMax(day) {
    const role = roles[editingMaxForIndex];
    const minValue = role.min || 1;
    if (tempDailyMaxCollabs[day] > minValue) {
      tempDailyMaxCollabs = {
        ...tempDailyMaxCollabs,
        [day]: tempDailyMaxCollabs[day] - 1
      };
    }
  }
  
  // Guardar cambios de máximos por día
  function saveDailyMaxChanges() {
    if (editingMaxForIndex >= 0 && editingMaxForIndex < roles.length) {
      // Crear copia de roles para mantener la reactividad
      const updatedRoles = [...roles];
      // Actualizar los máximos por día
      updatedRoles[editingMaxForIndex].dailyMaxCollabs = { ...tempDailyMaxCollabs };
      // Actualizar la lista de roles
      roles = updatedRoles;
      // Cerrar el modal
      closeDailyMaxModal();
    }
  }
  
  // ==================== FUNCIONES AUXILIARES ====================
  
  // Seleccionar/deseleccionar todos los días
  function selectAllDays(select = true) {
    const updatedDays = {};
    Object.keys(tempExcludedDays).forEach(day => {
      updatedDays[day] = select;
    });
    tempExcludedDays = updatedDays;
  }
  
  // Función para formatear días excluidos para mostrar
  function formatExcludedDays(daysObj) {
    if (!daysObj) return "Requerido todos los días";
    
    const excluded = Object.entries(daysObj)
      .filter(([_, value]) => value)
      .map(([day, _]) => dayTranslations[day]);
    
    return excluded.length > 0 
      ? `No requerido: ${excluded.join(', ')}` 
      : "Requerido todos los días";
  }
  
  // Verificar si un rol tiene días excluidos
  function hasExcludedDays(role) {
    if (!role.excludedDays) return false;
    return Object.values(role.excludedDays).some(value => value);
  }

  // Función para formatear máximos por día para mostrar
  function formatDailyMaxs(role) {
    if (!role.dailyMaxCollabs) return `Máx: ${role.max || 1}`;
    
    // Verificar si todos los días tienen el mismo máximo
    const values = Object.values(role.dailyMaxCollabs);
    const allSame = values.every(v => v === values[0]);
    
    if (allSame && values[0] === role.max) {
      return `Máx: ${role.max}`;
    }
    
    return "Máx. por día: Varía";
    }

  // Verificar si un rol tiene máximos variables por día
  function hasVariableMaxs(role) {
    if (!role.dailyMaxCollabs) return false;
    
    const values = Object.values(role.dailyMaxCollabs);
    const allSame = values.every(v => v === values[0]);
    
    return !allSame || values[0] !== role.max;
  }
  
  // ==================== FUNCIONES DE MONITOREO (OPCIONALES) ====================
  
  // Función para obtener estadísticas del servicio (opcional)
  async function getServiceStats() {
    try {
      const stats = await db.stats();
      console.log('📊 Estadísticas del servicio:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }
  
  // Función para verificar sincronización (opcional)
  async function checkSync() {
    try {
      const dbRoles = await db.getAll('roles');
      const isInSync = dbRoles.length === roles.length;
      console.log('🔄 Estado de sincronización roles:', isInSync ? 'OK' : 'Desincronizado');
      
      const dbCoverage = await db.getById('coverage', 1);
      const coverageInSync = JSON.stringify(dbCoverage?.roleNames || []) === JSON.stringify(selectedRolesToCover);
      console.log('🔄 Estado de sincronización cobertura:', coverageInSync ? 'OK' : 'Desincronizado');
      
      return isInSync && coverageInSync;
    } catch (error) {
      console.error('❌ Error verificando sincronización:', error);
      return false;
    }
  }
  
  // Función para recargar datos manualmente (opcional)
  async function refreshData() {
    try {
      console.log('🔄 Recargando datos manualmente...');
      await loadAllData();
      console.log('✅ Datos recargados correctamente');
    } catch (error) {
      console.error('❌ Error recargando datos:', error);
    }
  }
</script>

<section class="section-container roles-section">
  <h2>Gestión de Roles</h2>
  
  <div class="content">
    <form on:submit|preventDefault={handleSubmit} class="role-form">
      <div class="form-group">
        <label for="roleName">Nombre del Rol:</label>
        <input 
          id="roleName" 
          type="text" 
          bind:value={roleName} 
          placeholder="Nombre del Rol"
          class="{nameValidation ? 'input-error' : ''}"
          required
        />
        {#if nameValidation && roleName.trim()}
          <div class="input-hint error">{nameValidation}</div>
        {/if}
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="minCollaborators">Mínimo Colaboradores:</label>
          <div class="number-input-container">
            <button type="button" class="number-button" on:click={decrementMin}>-</button>
            <span class="number-display">{minCollaborators}</span>
            <button type="button" class="number-button" on:click={incrementMin}>+</button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="maxCollaborators">Máximo Colaboradores:</label>
          <div class="number-input-container">
            <button type="button" class="number-button" on:click={decrementMax}>-</button>
            <span class="number-display">{maxCollaborators}</span>
            <button type="button" class="number-button" on:click={incrementMax}>+</button>
          </div>
          <div class="input-hint">Máximo de colaboradores que pueden ser asignados a este rol por día</div>
        </div>
      </div>
      
      {#if formError}
        <div class="error-message">{formError}</div>
      {/if}
      
      <div class="form-actions">
        <button type="submit" class="action-button roles-button">
          Agregar Rol
        </button>
      </div>
    </form>
    
    <div class="role-management-container">
      <!-- Lista principal de roles -->
      {#if roles.length > 0}
        <div class="roles-list">
          <h3>Roles Configurados</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre del Rol</th>
                  <th>Mín</th>
                  <th>Máx</th>
                  <th>Días</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {#each [...roles].sort((a, b) => a.name.localeCompare(b.name)) as role (role.id || role.name)}
                  <tr>
                    <td>{role.name}</td>
                    <td>{role.min}</td>
                    <td>
                      <span class="max-value {hasVariableMaxs(role) ? 'has-variable-maxs' : ''}">
                        {formatDailyMaxs(role)}
                      </span>
                    </td>
                    <td>
                      <span class="days-info {hasExcludedDays(role) ? 'has-excluded' : ''}">
                        {formatExcludedDays(role.excludedDays)}
                      </span>
                    </td>
                    <td>
                      <button class="icon-button edit" on:click={() => {
                        const originalIndex = roles.findIndex(r => r.name === role.name);
                        openEditModal(originalIndex);
                      }}>
                        ✏️
                      </button>
                      <button class="icon-button calendar" on:click={() => {
                        const originalIndex = roles.findIndex(r => r.name === role.name);
                        openDaysModal(originalIndex);
                      }}>
                        📅
                      </button>
                      <button class="icon-button daily-max" on:click={() => {
                        const originalIndex = roles.findIndex(r => r.name === role.name);
                        openDailyMaxModal(originalIndex);
                      }} title="Configurar máximos por día">
                        👥
                      </button>
                      <button class="icon-button delete" on:click={() => {
                        const originalIndex = roles.findIndex(r => r.name === role.name);
                        deleteRole(originalIndex);
                      }}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {:else}
        <p class="no-data">No hay roles configurados</p>
      {/if}
      
      <!-- Sistema simple de grupos por colores -->
      {#if roles.length > 0}
        <div class="roles-coverage-list">
          <h3>Roles a cubrir por el mismo colaborador</h3>
          
          <!-- Selector de colores estilo macOS -->
          <div class="color-selector">
            <h4>Selecciona un grupo de color:</h4>
            <div class="color-buttons">
              {#each colorGroups as colorGroup}
                <button 
                  class="color-button {selectedColorGroup === colorGroup.id ? 'active' : ''}"
                  style="background-color: {colorGroup.color}"
                  on:click={() => selectColorGroup(colorGroup.id)}
                  title="{colorGroup.name} ({roleColorGroups[colorGroup.id].length} roles) - Clic para {selectedColorGroup === colorGroup.id ? 'desmarcar' : 'seleccionar'}"
                >
                  <span class="color-dot"></span>
                  {#if roleColorGroups[colorGroup.id].length > 0}
                    <span class="role-count">{roleColorGroups[colorGroup.id].length}</span>
                  {/if}
                </button>
              {/each}
            </div>
            
            {#if selectedColorGroup !== null}
              <p class="color-instruction selected">
                <span class="instruction-icon">👆</span>
                Seleccionando roles para: <strong>{colorGroups.find(c => c.id === selectedColorGroup)?.name}</strong>
              </p>
            {:else}
              <p class="color-instruction">
                <span class="instruction-icon">💡</span>
                Selecciona un color para empezar a agrupar roles
              </p>
            {/if}
          </div>
          
          <!-- Lista de roles con indicadores de color -->
          <div class="coverage-items">
            {#each [...roles].sort((a, b) => a.name.localeCompare(b.name)) as role (role.id || role.name)}
              {@const roleColor = getRoleColor(role.name)}
              <div 
                class="coverage-item {selectedColorGroup && roleColorGroups[selectedColorGroup].includes(role.name) ? 'selected' : ''} {!selectedColorGroup && roleColor ? 'has-color' : ''} {!selectedColorGroup ? 'disabled' : ''}"
                style={roleColor ? `border-color: ${roleColor.color}; background-color: ${roleColor.bgColor}` : ''}
                on:click={() => {
                  if (selectedColorGroup) {
                    toggleRoleInColorGroup(role.name);
                  }
                }}
                title={selectedColorGroup 
                      ? 'Clic para agregar/quitar del grupo ' + colorGroups.find(c => c.id === selectedColorGroup)?.name
                      : roleColor 
                        ? `Este rol está en ${roleColor.name}`
                        : 'Selecciona un color primero'}
              >
                <span class="role-name">{role.name}</span>
                {#if roleColor}
                  <span class="role-color-indicator" style="background-color: {roleColor.color}"></span>
                {/if}
              </div>
            {/each}
          </div>
          
          <!-- Información de compatibilidad -->
          <div class="coverage-info">
            <div class="coverage-summary">
              <h4>
                <span class="summary-icon">🔄</span>
                Resumen de Roles Compartidos
              </h4>
              <p class="help-text">
                Los siguientes roles serán considerados para asignación compartida:
                <br>
                <strong>
                  {selectedRolesToCover.length > 0 
                    ? `${selectedRolesToCover.length} roles: ${selectedRolesToCover.join(', ')}` 
                    : 'Ningún rol seleccionado'}
                  <br>
                  <br>
                  Selecciona un color y luego los roles que serán cubiertos por el mismo colaborador.
                  Cada color representa un grupo diferente.
                </strong>
              </p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>

<!-- Modal para editar roles -->
{#if showEditModal}
  <div class="modal-backdrop" on:click={closeEditModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>
          Actualizar Rol
          {#if editingIndex >= 0 && editingIndex < roles.length}
            <span class="modal-subtitle">{roles[editingIndex].name}</span>
          {/if}
        </h3>
        <button class="modal-close" on:click={closeEditModal}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label for="modalRoleName">Nombre del Rol:</label>
          <input 
            id="modalRoleName" 
            type="text" 
            bind:value={editingRoleData.name} 
            placeholder="Nombre del Rol"
            required
          />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="modalMinCollaborators">Mínimo Colaboradores:</label>
            <div class="number-input-container">
              <button 
                type="button" 
                class="number-button" 
                on:click={() => {
                  if (editingRoleData.min > 1) editingRoleData.min--;
                  if (editingRoleData.min > editingRoleData.max) editingRoleData.max = editingRoleData.min;
                }}
              >-</button>
              <span class="number-display">{editingRoleData.min}</span>
              <button 
                type="button" 
                class="number-button" 
                on:click={() => {
                  editingRoleData.min++;
                  if (editingRoleData.min > editingRoleData.max) editingRoleData.max = editingRoleData.min;
                }}
              >+</button>
            </div>
          </div>
          
          <div class="form-group">
            <label for="modalMaxCollaborators">Máximo Colaboradores:</label>
            <div class="number-input-container">
              <button 
                type="button" 
                class="number-button" 
                on:click={() => {
                  if (editingRoleData.max > editingRoleData.min) editingRoleData.max--;
                }}
              >-</button>
              <span class="number-display">{editingRoleData.max}</span>
              <button 
                type="button" 
                class="number-button" 
                on:click={() => {
                  editingRoleData.max++;
                }}
              >+</button>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="modalPriority">Prioridad:</label>
          <div class="number-input-container">
            <button 
              type="button" 
              class="number-button" 
              on:click={() => {
                if (editingRoleData.priority > 1) editingRoleData.priority--;
              }}
              disabled={editingRoleData.priority <= 1}
            >-</button>
            <span class="number-display">{editingRoleData.priority}</span>
            <button 
              type="button" 
              class="number-button" 
              on:click={() => {
                if (editingRoleData.priority < 2) editingRoleData.priority++;
              }}
              disabled={editingRoleData.priority >= 2}
            >+</button>
          </div>
          <div class="input-hint">1 = Mayor prioridad, 2 = Menor prioridad</div>
        </div>
        
        {#if formError}
          <div class="error-message">{formError}</div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="cancel-button" on:click={closeEditModal}>Cancelar</button>
        <button class="action-button roles-button" on:click={saveRoleChanges}>
          Guardar Cambios
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal para días excluidos -->

{#if showDaysModal}
  <div class="modal-backdrop" on:click={closeDaysModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>
          Configurar días excluidos
          {#if editingDaysForIndex >= 0 && editingDaysForIndex < roles.length}
            <span class="modal-subtitle">para {roles[editingDaysForIndex].name}</span>
          {/if}
        </h3>
        <button class="modal-close" on:click={closeDaysModal}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="days-section">
          <div class="days-header">
            <h4>Días en que NO se requiere este rol</h4>
            <div class="days-actions">
              <button class="days-action-button select-all" on:click={() => selectAllDays(true)}>
                Excluir todos
              </button>
              <button class="days-action-button clear-all" on:click={() => selectAllDays(false)}>
                Incluir todos
              </button>
            </div>
          </div>
          
          <p class="modal-description">
            Nota: Por defecto, los roles se requieren todos los días (lunes a viernes). Selecciona los días en los que excepcionalmente NO se requiere este rol.
          </p>
          
          <div class="days-grid">
            {#each Object.entries(tempExcludedDays) as [day, isExcluded]}
              <div 
                class="day-item {isExcluded ? 'day-excluded' : ''}"
                on:click={() => toggleDayExcluded(day)}
              >
                <div class="day-name">{dayTranslations[day]}</div>
                <div class="day-status">
                  {isExcluded ? 'No requerido' : 'Requerido'}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-button" on:click={closeDaysModal}>Cancelar</button>
        <button class="action-button roles-button" on:click={saveDaysChanges}>
          Guardar Cambios
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal para configurar máximos por día -->
{#if showDailyMaxModal}
  <div class="modal-backdrop" on:click={closeDailyMaxModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>
          Configurar Máximos por Día
          {#if editingMaxForIndex >= 0 && editingMaxForIndex < roles.length}
            <span class="modal-subtitle">para {roles[editingMaxForIndex].name}</span>
          {/if}
        </h3>
        <button class="modal-close" on:click={closeDailyMaxModal}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="days-section">
          <div class="days-header">
            <h4>Máximo de colaboradores por día</h4>
          </div>
          
          <p class="modal-description">
            Configure el número máximo de colaboradores permitidos para cada día de la semana.
          </p>
          
          <div class="days-grid">
            {#each Object.entries(tempDailyMaxCollabs) as [day, maxValue]}
              <div class="day-item daily-max-item">
                <div class="day-name">{dayTranslations[day]}</div>
                <div class="day-max-control">
                  <div class="number-input-container compact">
                    <button 
                      type="button" 
                      class="number-button" 
                      on:click={() => decrementDailyMax(day)}
                      disabled={maxValue <= (roles[editingMaxForIndex]?.min || 1)}
                    >-</button>
                    <span class="number-display">{maxValue}</span>
                    <button 
                      type="button" 
                      class="number-button" 
                      on:click={() => incrementDailyMax(day)}
                    >+</button>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <div class="modal-note">
            <p>
              Nota: El máximo global para este rol es {roles[editingMaxForIndex]?.max || 1}, 
              pero puede configurar un máximo diferente para cada día de la semana.
            </p>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-button" on:click={closeDailyMaxModal}>Cancelar</button>
        <button class="action-button roles-button" on:click={saveDailyMaxChanges}>
          Guardar Cambios
        </button>
      </div>
    </div>
  </div>
{/if}