// ==================== SERVICIO UNIFICADO DE BASE DE DATOS ====================
// Archivo: src/lib/services/DatabaseService.js

class DatabaseService {
  static instance = null;
  static DB_NAME_PREFIX = 'GestionRotacionesDB';
  static DB_VERSION = 3;
  
  constructor() {
    if (DatabaseService.instance) {
      return DatabaseService.instance;
    }
    
    this.db = null;
    this.isInitialized = false;
    this.subscribers = new Map(); // Para notificaciones entre componentes
    this.initPromise = null; // Para evitar múltiples inicializaciones
    this.currentTeamId = 0; // ID del equipo actual
    
    DatabaseService.instance = this;
  }
  
  // ==================== MÉTODOS PARA EQUIPOS ====================
  
  static getDBName(teamId = 0) {
    return `${DatabaseService.DB_NAME_PREFIX}_Team${teamId}`;
  }
  
  async switchTeam(teamId) {
    if (this.currentTeamId === teamId && this.isInitialized) {
      console.log(`✅ Ya estás en el equipo ${teamId}`);
      return this.db;
    }
    
    console.log(`🔄 Cambiando del equipo ${this.currentTeamId} al equipo ${teamId}...`);
    
    // Cerrar conexión actual si existe
    if (this.db) {
      this.db.close();
      console.log(`🔒 Conexión cerrada para equipo ${this.currentTeamId}`);
    }
    
    // Resetear estado
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.currentTeamId = teamId;
    
    // Notificar a los suscriptores del cambio de equipo
    this._notifyTeamChange(teamId);
    
    // Inicializar con el nuevo equipo
    return this.init(teamId);
  }
  
  getCurrentTeamId() {
    return this.currentTeamId;
  }
  
  _notifyTeamChange(newTeamId) {
    // Notificar a todos los suscriptores que hubo un cambio de equipo
    this.subscribers.forEach((callbacks, storeName) => {
      callbacks.forEach(callback => {
        try {
          callback({ 
            storeName, 
            action: 'teamChange', 
            data: { 
              oldTeamId: this.currentTeamId, 
              newTeamId: newTeamId 
            } 
          });
        } catch (error) {
          console.error('❌ Error en callback de cambio de equipo:', error);
        }
      });
    });
  }
  
  // ==================== INICIALIZACIÓN ====================
  
  async init(teamId = null) {
    // Si se proporciona un teamId, usarlo
    if (teamId !== null && teamId !== this.currentTeamId) {
      return this.switchTeam(teamId);
    }
    
    // Si ya está inicializada para el equipo actual, devolver la instancia
    if (this.isInitialized && this.db && this.currentTeamId === (teamId ?? this.currentTeamId)) {
      return this.db;
    }
    
    // Si ya hay una inicialización en curso, esperarla
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // Crear nueva promesa de inicialización
    this.initPromise = this._initDatabase(teamId ?? this.currentTeamId);
    
    try {
      const db = await this.initPromise;
      this.isInitialized = true;
      return db;
    } catch (error) {
      this.initPromise = null; // Permitir reintentos
      throw error;
    }
  }
  
  _initDatabase(teamId) {
    return new Promise((resolve, reject) => {
      const dbName = DatabaseService.getDBName(teamId);
      console.log(`🚀 Inicializando base de datos para equipo ${teamId}: ${dbName}...`);
      
      const request = indexedDB.open(dbName, DatabaseService.DB_VERSION);
      
      request.onerror = (event) => {
        console.error(`❌ Error abriendo base de datos del equipo ${teamId}:`, event);
        reject(new Error('Failed to open database'));
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.currentTeamId = teamId;
        console.log(`✅ Base de datos abierta correctamente para equipo ${teamId}`);
        
        // Configurar manejo de errores globales
        this.db.onerror = (event) => {
          console.error(`❌ Error en base de datos del equipo ${teamId}:`, event);
        };
        
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log(`🔄 Actualizando estructura de base de datos del equipo ${teamId} de v${event.oldVersion} a v${event.newVersion}...`);
        
        this._createObjectStores(db, event.oldVersion);
        this._migrateData(event.oldVersion, event.newVersion, teamId);
      };
    });
  }
  
  _createObjectStores(db, oldVersion) {
    const stores = [
      {
        name: 'roles',
        keyPath: 'id',
        autoIncrement: true,
        description: 'Almacén de roles y certificaciones'
      },
      {
        name: 'collaborators',
        keyPath: 'id',
        autoIncrement: true,
        description: 'Almacén de colaboradores'
      },
      {
        name: 'coverage',
        keyPath: 'id',
        description: 'Configuración de roles compartidos (legacy)'
      },
      {
        name: 'colorGroups',
        keyPath: 'id',
        description: 'Configuración de grupos por colores'
      },
      {
        name: 'rotations',
        keyPath: 'id',
        autoIncrement: true,
        description: 'Rotaciones por mes/año'
      },
      {
        name: 'rotationConfig',
        keyPath: 'id',
        description: 'Configuración general del sistema de rotaciones'
      },
      {
        name: 'teamConfig',
        keyPath: 'id',
        description: 'Configuración específica del equipo'
      }
    ];
    
    stores.forEach(storeConfig => {
      if (!db.objectStoreNames.contains(storeConfig.name)) {
        console.log(`📦 Creando almacén: ${storeConfig.name}`);
        
        const store = db.createObjectStore(storeConfig.name, {
          keyPath: storeConfig.keyPath,
          autoIncrement: storeConfig.autoIncrement || false
        });
        
        // Crear índices específicos
        if (storeConfig.name === 'rotations') {
          store.createIndex('monthYear', ['year', 'month'], { unique: false });
          store.createIndex('rotationNumber', 'rotationNumber', { unique: false });
        }
        
        console.log(`✅ ${storeConfig.description} creado`);
      } else {
        console.log(`✓ Almacén ya existe: ${storeConfig.name}`);
      }
    });
  }
  
  _migrateData(oldVersion, newVersion, teamId) {
    console.log(`🔄 Migrando datos de versión ${oldVersion} a ${newVersion} para equipo ${teamId}`);
    
    if (oldVersion < 2) {
      // Migración de localStorage a IndexedDB si es necesario
      this._migrateFromLocalStorage(teamId);
    }
    
    if (oldVersion < 3) {
      // Inicializar colorGroups si no existe
      console.log('🔄 Inicializando datos para grupos por colores...');
      setTimeout(() => {
        this._initializeColorGroups();
      }, 100);
    }
  }
  
  async _initializeColorGroups() {
    try {
      // Verificar si ya existen datos de colorGroups
      const existingColorGroups = await this.getById('colorGroups', 1).catch(() => null);
      
      if (!existingColorGroups) {
        // Inicializar con estructura vacía
        const defaultColorGroups = {
          id: 1,
          groups: {
            blue: [],
            orange: [],
            green: []
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await this.save('colorGroups', defaultColorGroups);
        console.log('✅ Grupos por colores inicializados');
      }
    } catch (error) {
      console.error('❌ Error inicializando grupos por colores:', error);
    }
  }
  
  async _migrateFromLocalStorage(teamId) {
    try {
      console.log(`📦 Migrando datos desde localStorage para equipo ${teamId}...`);
      
      // Prefijo para localStorage específico del equipo
      const prefix = teamId > 0 ? `gestionRotaciones_team${teamId}_` : 'gestionRotaciones_';
      
      // Migrar roles
      const savedRoles = localStorage.getItem(`${prefix}roles`);
      if (savedRoles) {
        const roles = JSON.parse(savedRoles);
        await this.saveAll('roles', roles);
        console.log('✅ Roles migrados');
      }
      
      // Migrar colaboradores
      const savedCollaborators = localStorage.getItem(`${prefix}collaborators`);
      if (savedCollaborators) {
        const collaborators = JSON.parse(savedCollaborators);
        await this.saveAll('collaborators', collaborators);
        console.log('✅ Colaboradores migrados');
      }
      
      // Migrar cobertura
      const savedCoverage = localStorage.getItem(`${prefix}coverage`);
      if (savedCoverage) {
        await this.save('coverage', {
          id: 1,
          roleNames: JSON.parse(savedCoverage)
        });
        console.log('✅ Cobertura migrada');
      }
      
      // Migrar grupos por colores
      const savedColorGroups = localStorage.getItem(`${prefix}colorGroups`);
      if (savedColorGroups) {
        await this.save('colorGroups', {
          id: 1,
          groups: JSON.parse(savedColorGroups)
        });
        console.log('✅ Grupos por colores migrados desde localStorage');
      }
      
      console.log('🎉 Migración completada exitosamente');
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
    }
  }
  
  // ==================== OPERACIONES CRUD ====================
  
  async save(storeName, data) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => {
          console.log(`✅ Datos guardados en ${storeName} (Equipo ${this.currentTeamId})`);
          this.notify(storeName, 'save', data);
          resolve();
        };
        
        transaction.onerror = () => {
          console.error(`❌ Error guardando en ${storeName}:`, transaction.error);
          reject(transaction.error);
        };
        
        if (data.id) {
          store.put(data);
        } else {
          store.add(data);
        }
      } catch (error) {
        console.error(`❌ Error en transacción ${storeName}:`, error);
        reject(error);
      }
    });
  }
  
  async saveAll(storeName, items) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => {
          console.log(`✅ ${items.length} elementos guardados en ${storeName} (Equipo ${this.currentTeamId})`);
          this.notify(storeName, 'saveAll', items);
          resolve();
        };
        
        transaction.onerror = () => {
          console.error(`❌ Error guardando múltiples en ${storeName}:`, transaction.error);
          reject(transaction.error);
        };
        
        // Limpiar store primero
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
          // Agregar todos los elementos
          items.forEach((item, index) => {
            const itemWithId = { ...item, id: item.id || index + 1 };
            store.add(itemWithId);
          });
        };
        
        clearRequest.onerror = () => {
          reject(clearRequest.error);
        };
      } catch (error) {
        console.error(`❌ Error en transacción saveAll ${storeName}:`, error);
        reject(error);
      }
    });
  }
  
  async getAll(storeName) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
          console.log(`📖 ${request.result.length} elementos cargados de ${storeName} (Equipo ${this.currentTeamId})`);
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error(`❌ Error cargando de ${storeName}:`, request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error(`❌ Error en transacción getAll ${storeName}:`, error);
        reject(error);
      }
    });
  }
  
  async getById(storeName, id) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        
        request.onsuccess = () => {
          resolve(request.result);
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      } catch (error) {
        console.error(`❌ Error en transacción getById ${storeName}:`, error);
        reject(error);
      }
    });
  }
  
  async delete(storeName, id) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => {
          console.log(`🗑️ Elemento ${id} eliminado de ${storeName} (Equipo ${this.currentTeamId})`);
          this.notify(storeName, 'delete', { id });
          resolve();
        };
        
        request.onerror = () => {
          console.error(`❌ Error eliminando de ${storeName}:`, request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error(`❌ Error en transacción delete ${storeName}:`, error);
        reject(error);
      }
    });
  }
  
  async clear(storeName) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log(`🧹 Almacén ${storeName} limpiado (Equipo ${this.currentTeamId})`);
          this.notify(storeName, 'clear');
          resolve();
        };
        
        request.onerror = () => {
          console.error(`❌ Error limpiando ${storeName}:`, request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error(`❌ Error en transacción clear ${storeName}:`, error);
        reject(error);
      }
    });
  }
  
  // ==================== SISTEMA DE NOTIFICACIONES ====================
  
  subscribe(storeName, callback) {
    if (!this.subscribers.has(storeName)) {
      this.subscribers.set(storeName, new Set());
    }
    this.subscribers.get(storeName).add(callback);
    
    console.log(`🔔 Suscripción agregada para ${storeName} (Equipo ${this.currentTeamId})`);
    
    // Devolver función para desuscribirse
    return () => this.unsubscribe(storeName, callback);
  }
  
  unsubscribe(storeName, callback) {
    if (this.subscribers.has(storeName)) {
      this.subscribers.get(storeName).delete(callback);
      console.log(`🔕 Suscripción removida para ${storeName}`);
    }
  }
  
  // CAMBIADO: De _notify a notify (ahora es pública)
  notify(storeName, action, data = null) {
    if (this.subscribers.has(storeName)) {
      const callbacks = this.subscribers.get(storeName);
      callbacks.forEach(callback => {
        try {
          callback({ 
            storeName, 
            action, 
            data,
            teamId: this.currentTeamId 
          });
        } catch (error) {
          console.error('❌ Error en callback de notificación:', error);
        }
      });
    }
  }
  
  // ==================== UTILIDADES ====================
  
  async isStoreEmpty(storeName) {
    try {
      const items = await this.getAll(storeName);
      return items.length === 0;
    } catch (error) {
      console.error(`❌ Error verificando si ${storeName} está vacío:`, error);
      return true;
    }
  }
  
  async getStorageStats() {
    if (!this.db) return null;
    
    try {
      const stats = {};
      const storeNames = ['roles', 'collaborators', 'coverage', 'colorGroups', 'rotations', 'rotationConfig', 'teamConfig'];
      
      for (const storeName of storeNames) {
        try {
          const items = await this.getAll(storeName);
          stats[storeName] = {
            count: items.length,
            size: JSON.stringify(items).length
          };
        } catch (error) {
          console.warn(`⚠️ No se pudo obtener stats para ${storeName}:`, error);
          stats[storeName] = {
            count: 0,
            size: 0,
            error: error.message
          };
        }
      }
      
      return {
        teamId: this.currentTeamId,
        stores: stats,
        totalSize: Object.values(stats).reduce((sum, store) => sum + (store.size || 0), 0),
        lastAccessed: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }
  
  // ==================== MÉTODOS PARA GESTIÓN DE EQUIPOS ====================
  
  async getTeamConfig() {
    try {
      const config = await this.getById('teamConfig', 1);
      return config || {
        id: 1,
        teamId: this.currentTeamId,
        name: `Equipo ${this.currentTeamId + 1}`,
        color: this.currentTeamId === 0 ? '#3498db' : this.currentTeamId === 1 ? '#e74c3c' : '#2ecc71',
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error obteniendo configuración del equipo:', error);
      return null;
    }
  }
  
  async saveTeamConfig(config) {
    try {
      await this.save('teamConfig', {
        id: 1,
        ...config,
        teamId: this.currentTeamId,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Configuración del equipo guardada');
    } catch (error) {
      console.error('❌ Error guardando configuración del equipo:', error);
    }
  }
  
  // ==================== FALLBACK A LOCALSTORAGE ====================
  
  async saveToLocalStorage(key, data) {
    try {
      // Incluir el ID del equipo en la clave
      const teamKey = this.currentTeamId > 0 ? `team${this.currentTeamId}_${key}` : key;
      localStorage.setItem(teamKey, JSON.stringify(data));
      console.log(`💾 Respaldo guardado en localStorage: ${teamKey}`);
    } catch (error) {
      console.error(`❌ Error guardando en localStorage:`, error);
    }
  }
  
  getFromLocalStorage(key, defaultValue = null) {
    try {
      // Incluir el ID del equipo en la clave
      const teamKey = this.currentTeamId > 0 ? `team${this.currentTeamId}_${key}` : key;
      const data = localStorage.getItem(teamKey);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error(`❌ Error cargando de localStorage:`, error);
      return defaultValue;
    }
  }
  
  // ==================== OPERACIONES ESPECÍFICAS DEL NEGOCIO ====================
  
  async getRotationByMonthYear(year, month) {
    try {
      const rotations = await this.getAll('rotations');
      return rotations.find(r => r.year === year && r.month === month);
    } catch (error) {
      console.error('❌ Error obteniendo rotación:', error);
      return null;
    }
  }
  
  async saveRotation(year, month, assignments) {
    try {
      const existingRotations = await this.getAll('rotations');
      const existingRotation = existingRotations.find(r => r.year === year && r.month === month);
      
      const rotationData = {
        year,
        month,
        assignments,
        teamId: this.currentTeamId,
        updatedAt: new Date().toISOString()
      };
      
      if (existingRotation) {
        rotationData.id = existingRotation.id;
      }
      
      await this.save('rotations', rotationData);
      
      // También guardar en localStorage como respaldo
      await this.saveToLocalStorage('gestionRotaciones_currentRotation', rotationData);
      
      return rotationData;
    } catch (error) {
      console.error('❌ Error guardando rotación:', error);
      throw error;
    }
  }
  
  // ==================== REINICIALIZACIÓN ====================
  
  async reinitializeDatabase() {
    try {
      console.log(`🔄 Reinicializando base de datos del equipo ${this.currentTeamId}...`);
      
      // Cerrar conexión actual si existe
      if (this.db) {
        this.db.close();
      }
      
      // Reset estado
      this.db = null;
      this.isInitialized = false;
      this.initPromise = null;
      
      // Eliminar la base de datos existente
      const dbName = DatabaseService.getDBName(this.currentTeamId);
      await new Promise((resolve, reject) => {
        const deleteReq = indexedDB.deleteDatabase(dbName);
        deleteReq.onsuccess = () => {
          console.log(`✅ Base de datos ${dbName} eliminada`);
          resolve();
        };
        deleteReq.onerror = () => {
          console.error('❌ Error eliminando base de datos:', deleteReq.error);
          reject(deleteReq.error);
        };
      });
      
      // Reinicializar
      await this.init(this.currentTeamId);
      
      console.log('✅ Base de datos reinicializada correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error reinicializando base de datos:', error);
      return false;
    }
  }
  
  // ==================== OPERACIONES ENTRE EQUIPOS ====================
  
  async copyDataBetweenTeams(fromTeamId, toTeamId, stores = ['roles', 'collaborators']) {
    try {
      console.log(`📋 Copiando datos del equipo ${fromTeamId} al equipo ${toTeamId}...`);
      
      // Guardar el equipo actual
      const originalTeamId = this.currentTeamId;
      
      // Cambiar al equipo origen
      await this.switchTeam(fromTeamId);
      
      // Leer datos
      const data = {};
      for (const storeName of stores) {
        data[storeName] = await this.getAll(storeName);
      }
      
      // Cambiar al equipo destino
      await this.switchTeam(toTeamId);
      
      // Escribir datos
      for (const storeName of stores) {
        if (data[storeName] && data[storeName].length > 0) {
          await this.saveAll(storeName, data[storeName]);
        }
      }
      
      // Volver al equipo original
      await this.switchTeam(originalTeamId);
      
      console.log('✅ Datos copiados exitosamente');
      return true;
    } catch (error) {
      console.error('❌ Error copiando datos entre equipos:', error);
      return false;
    }
  }
}

// ==================== INSTANCIA SINGLETON ====================

// Crear y exportar instancia única
export const dbService = new DatabaseService();

// También exportar la clase para casos específicos
export { DatabaseService };

// ==================== FUNCIONES DE CONVENIENCIA ====================

// Funciones helper para uso directo sin instanciar
export const db = {
  init: (teamId) => dbService.init(teamId),
  
  // Operaciones CRUD simplificadas
  save: (store, data) => dbService.save(store, data),
  saveAll: (store, items) => dbService.saveAll(store, items),
  getAll: (store) => dbService.getAll(store),
  getById: (store, id) => dbService.getById(store, id),
  delete: (store, id) => dbService.delete(store, id),
  clear: (store) => dbService.clear(store),
  
  // Suscripciones
  subscribe: (store, callback) => dbService.subscribe(store, callback),
  
  // NUEVO: Función notify ahora es pública
  notify: (store, action, data) => dbService.notify(store, action, data),
  
  // Operaciones específicas
  getRotation: (year, month) => dbService.getRotationByMonthYear(year, month),
  saveRotation: (year, month, assignments) => dbService.saveRotation(year, month, assignments),
  
  // Utilidades
  stats: () => dbService.getStorageStats(),
  isEmpty: (store) => dbService.isStoreEmpty(store),
  
  // Funciones de reinicialización
  reinitialize: () => dbService.reinitializeDatabase(),
  
  // Funciones para equipos
  switchTeam: (teamId) => dbService.switchTeam(teamId),
  getCurrentTeamId: () => dbService.getCurrentTeamId(),
  getTeamConfig: () => dbService.getTeamConfig(),
  saveTeamConfig: (config) => dbService.saveTeamConfig(config),
  copyDataBetweenTeams: (fromTeamId, toTeamId, stores) => dbService.copyDataBetweenTeams(fromTeamId, toTeamId, stores)
};