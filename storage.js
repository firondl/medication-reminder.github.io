// 本地存储管理模块
class StorageManager {
    constructor() {
        this.MEDICATIONS_KEY = 'medication_reminders';
        this.RECORDS_KEY = 'medication_records';
        this.SETTINGS_KEY = 'app_settings';
        this.DELAYS_KEY = 'medication_delays';
        this.BACKUP_KEY = 'backup_timestamps';
        this.CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时清理一次
        this.BACKUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7天备份一次
        
        // 初始化时启动定期清理和备份任务
        this.scheduleCleanupAndBackup();
    }

    // --- 数据验证工具 ---
    
/**
 * 验证用药提醒数据格式
 * @param {Object} medication - 用药提醒对象
 * @returns {boolean} 是否有效
 */
validateMedicationData(medication) {
    try {
        if (!medication || typeof medication !== 'object') {
            throw new Error('用药提醒数据必须是对象');
        }
        
        if (!medication.name || typeof medication.name !== 'string' || medication.name.trim() === '') {
            throw new Error('用药提醒必须包含有效的名称');
        }
        
        // 验证时间数组
        if (!Array.isArray(medication.times) || medication.times.length === 0) {
            throw new Error('用药提醒必须包含至少一个时间');
        }
        
        // 验证所有时间格式和时间段
        for (const timeEntry of medication.times) {
            if (!timeEntry.time || !this.isValidTimeFormat(timeEntry.time)) {
                throw new Error('用药提醒必须包含有效的时间格式 (HH:MM)');
            }
            
            if (!timeEntry.timeSlot || !['morning', 'noon', 'evening'].includes(timeEntry.timeSlot)) {
                throw new Error('用药提醒必须包含有效的时间段 (morning, noon, evening)');
            }
        }
        
        const validFrequencies = ['once', 'daily', 'weekly', 'custom'];
        if (!validFrequencies.includes(medication.frequency)) {
            throw new Error('用药提醒必须包含有效的频次 (once, daily, weekly, custom)');
        }
        
        if (medication.frequency === 'custom' && (!medication.customInterval || medication.customInterval <= 0)) {
            throw new Error('自定义频次必须包含大于0的间隔天数');
        }
        
        return true;
    } catch (error) {
        console.error('验证用药提醒数据失败:', error);
        return false;
    }
}


    /**
 * 验证记录数据格式
 * @param {Object} record - 记录对象
 * @returns {boolean} 是否有效
 */
validateRecordData(record) {
    try {
        if (!record || typeof record !== 'object') {
            throw new Error('记录数据必须是对象');
        }
        
        const validActions = ['taken', 'cancelled']; // 只允许服用和取消
        if (!validActions.includes(record.action)) {
            throw new Error('记录必须包含有效的动作 (taken, cancelled)');
        }
        
        if (!record.medicationId || typeof record.medicationId !== 'string') {
            throw new Error('记录必须包含有效的用药提醒ID');
        }
        
        if (record.timestamp && !this.isValidTimestamp(record.timestamp)) {
            throw new Error('记录必须包含有效的时间戳');
        }
        
        return true;
    } catch (error) {
        console.error('验证记录数据失败:', error);
        return false;
    }
}

    /**
     * 验证时间格式 (HH:MM)
     * @param {string} time - 时间字符串
     * @returns {boolean} 是否有效
     */
    isValidTimeFormat(time) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    }

    /**
     * 验证时间戳格式
     * @param {string} timestamp - 时间戳字符串
     * @returns {boolean} 是否有效
     */
    isValidTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date instanceof Date && !isNaN(date);
    }

    // --- 用药提醒 CRUD 操作 ---

    /**
     * 获取所有用药提醒
     * @returns {Array} 用药提醒数组
     */
    getAllMedications() {
        try {
            const medications = localStorage.getItem(this.MEDICATIONS_KEY);
            const parsed = medications ? JSON.parse(medications) : [];
            
            // 验证并过滤无效数据
            const validMedications = parsed.filter(med => this.validateMedicationData(med));
            
            // 如果有过滤掉的数据，更新存储
            if (parsed.length !== validMedications.length) {
                this.saveMedications(validMedications);
            }
            
            return validMedications;
        } catch (error) {
            console.error('获取用药提醒失败:', error);
            return [];
        }
    }

    /**
     * 保存用药提醒列表
     * @param {Array} medications - 用药提醒数组
     */
    saveMedications(medications) {
        try {
            // 验证所有数据
            const validMedications = medications.filter(med => this.validateMedicationData(med));
            localStorage.setItem(this.MEDICATIONS_KEY, JSON.stringify(validMedications));
        } catch (error) {
            console.error('保存用药提醒失败:', error);
            throw error;
        }
    }

    /**
     * 添加单个用药提醒
     * @param {Object} medication - 用药提醒对象
     * @returns {string} 新增用药提醒的ID
     */
    addMedication(medication) {
        try {
            if (!this.validateMedicationData(medication)) {
                throw new Error('无效的用药提醒数据');
            }
            
            const medications = this.getAllMedications();
            // 生成唯一ID
            const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const newMedication = {
                ...medication,
                id,
                createdAt: new Date().toISOString(),
                enabled: medication.enabled !== undefined ? medication.enabled : true
            };
            
            medications.push(newMedication);
            this.saveMedications(medications);
            return id;
        } catch (error) {
            console.error('添加用药提醒失败:', error);
            throw error;
        }
    }

    /**
     * 更新用药提醒
     * @param {string} id - 用药提醒ID
     * @param {Object} updates - 更新的数据
     * @returns {boolean} 是否更新成功
     */
    updateMedication(id, updates) {
        try {
            const medications = this.getAllMedications();
            const index = medications.findIndex(m => m.id === id);
            
            if (index === -1) {
                return false;
            }
            
            // 合并更新
            const updatedMedication = { ...medications[index], ...updates };
            
            if (!this.validateMedicationData(updatedMedication)) {
                throw new Error('更新后的用药提醒数据无效');
            }
            
            medications[index] = updatedMedication;
            this.saveMedications(medications);
            return true;
        } catch (error) {
            console.error('更新用药提醒失败:', error);
            return false;
        }
    }

    /**
     * 删除用药提醒
     * @param {string} id - 用药提醒ID
     * @returns {boolean} 是否删除成功
     */
    // 替换 deleteMedication 方法
deleteMedication(id, timeToRemove = null, timeSlotToRemove = null) {
    try {
        if (timeToRemove && timeSlotToRemove) {
            // 删除特定时间点
            if (confirm('确定要删除这个时间点的提醒吗？')) {
                const success = this.storage.deleteMedicationTime(id, timeToRemove, timeSlotToRemove);
                if (success) {
                    this.loadMedications();
                    this.showSuccess('时间点提醒已删除');
                } else {
                    throw new Error('删除时间点提醒失败');
                }
            }
        } else {
            // 删除整个用药提醒
            if (confirm('确定要删除这个用药提醒吗？此操作不可撤销。')) {
                const success = this.storage.deleteMedication(id);
                if (success) {
                    this.loadMedications();
                    this.showSuccess('用药提醒已删除');
                } else {
                    throw new Error('删除用药提醒失败');
                }
            }
        }
    } catch (error) {
        console.error('删除用药提醒失败:', error);
        this.showError(error.message || '删除用药提醒时发生错误');
    }
}

    /**
     * 根据时间段获取用药提醒
     * @param {string} timeOfDay - 时间段 ('morning', 'noon', 'evening')
     * @returns {Array} 对应时间段的用药提醒数组
     */
    getMedicationsByTime(timeOfDay) {
        try {
            const medications = this.getAllMedications();
            return medications.filter(m => m.timeOfDay === timeOfDay);
        } catch (error) {
            console.error('获取时间段用药提醒失败:', error);
            return [];
        }
    }

    // --- 用药记录管理 ---

    /**
     * 记录用药行为
     * @param {string} medicationId - 用药提醒ID
     * @param {string} action - 用药行为 ('taken', 'delayed', 'cancelled')
     * @param {number} delayMinutes - 延迟分钟数（可选）
     * @returns {Object} 记录对象
     */
    recordMedication(medicationId, action = 'taken', delayMinutes = 0) {
        try {
            const record = {
                medicationId,
                action,
                delayMinutes,
                timestamp: new Date().toISOString(),
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
            };
            
            if (!this.validateRecordData(record)) {
                throw new Error('无效的记录数据');
            }
            
            const records = this.getRecords();
            records.push(record);
            localStorage.setItem(this.RECORDS_KEY, JSON.stringify(records));
            return record;
        } catch (error) {
            console.error('记录用药失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有用药记录
     * @returns {Array} 用药记录数组
     */
    getRecords() {
        try {
            const records = localStorage.getItem(this.RECORDS_KEY);
            const parsed = records ? JSON.parse(records) : [];
            
            // 验证并过滤无效数据
            const validRecords = parsed.filter(rec => this.validateRecordData(rec));
            
            // 如果有过滤掉的数据，更新存储
            if (parsed.length !== validRecords.length) {
                localStorage.setItem(this.RECORDS_KEY, JSON.stringify(validRecords));
            }
            
            return validRecords;
        } catch (error) {
            console.error('获取用药记录失败:', error);
            return [];
        }
    }

    /**
     * 获取特定药品的记录
     * @param {string} medicationId - 用药提醒ID
     * @returns {Array} 特定药品的记录数组
     */
    getMedicationRecords(medicationId) {
        try {
            const records = this.getRecords();
            return records.filter(r => r.medicationId === medicationId);
        } catch (error) {
            console.error('获取特定药品记录失败:', error);
            return [];
        }
    }

    /**
     * 删除特定药品的所有记录
     * @param {string} medicationId - 用药提醒ID
     */
    deleteMedicationRecords(medicationId) {
        try {
            const records = this.getRecords();
            const filtered = records.filter(r => r.medicationId !== medicationId);
            localStorage.setItem(this.RECORDS_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.error('删除特定药品记录失败:', error);
        }
    }

    /**
     * 清空所有用药记录
     */
    clearAllRecords() {
        try {
            localStorage.removeItem(this.RECORDS_KEY);
        } catch (error) {
            console.error('清空用药记录失败:', error);
        }
    }

    // --- 延迟提醒管理 ---

/**
 * 设置延迟提醒
 * @param {string} medicationId - 用药提醒ID
 * @param {number} delayMinutes - 延迟分钟数
 * @param {string} originalTime - 原始提醒时间
 */
setDelay(medicationId, delayMinutes, originalTime) {
    try {
        const delays = this.getDelays();
        const delayTime = new Date(originalTime);
        delayTime.setMinutes(delayTime.getMinutes() + delayMinutes);
        
        delays[medicationId] = {
            originalTime,
            delayTime: delayTime.toISOString(),
            delayMinutes
        };
        
        localStorage.setItem(this.DELAYS_KEY, JSON.stringify(delays));
    } catch (error) {
        console.error('设置延迟提醒失败:', error);
        throw error;
    }
}

    /**
     * 获取所有延迟设置
     * @returns {Object} 延迟设置对象
     */
    getDelays() {
        try {
            const delays = localStorage.getItem(this.DELAYS_KEY);
            return delays ? JSON.parse(delays) : {};
        } catch (error) {
            console.error('获取延迟设置失败:', error);
            return {};
        }
    }

    /**
     * 清除延迟设置
     * @param {string} medicationId - 用药提醒ID
     */
    clearDelay(medicationId) {
        try {
            const delays = this.getDelays();
            if (delays[medicationId]) {
                delete delays[medicationId];
                localStorage.setItem(this.DELAYS_KEY, JSON.stringify(delays));
            }
        } catch (error) {
            console.error('清除延迟设置失败:', error);
        }
    }

    /**
     * 获取特定药物的延迟信息
     * @param {string} medicationId - 用药提醒ID
     * @returns {Object|null} 延迟信息对象或null
     */
    getDelayForMedication(medicationId) {
        try {
            const delays = this.getDelays();
            return delays[medicationId] || null;
        } catch (error) {
            console.error('获取特定药物延迟信息失败:', error);
            return null;
        }
    }

    // --- 应用设置管理 ---

    /**
     * 获取应用设置
     * @returns {Object} 应用设置对象
     */
    getSettings() {
        try {
            const settings = localStorage.getItem(this.SETTINGS_KEY);
            return settings ? JSON.parse(settings) : {
                soundEnabled: true,
                notificationEnabled: true,
                theme: 'light',
                volume: 0.8,
                reminderSnoozeTime: 5
            };
        } catch (error) {
            console.error('获取应用设置失败:', error);
            return {
                soundEnabled: true,
                notificationEnabled: true,
                theme: 'light',
                volume: 0.8,
                reminderSnoozeTime: 5
            };
        }
    }

    /**
     * 保存应用设置
     * @param {Object} settings - 应用设置对象
     */
    saveSettings(settings) {
        try {
            const currentSettings = this.getSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updatedSettings));
        } catch (error) {
            console.error('保存应用设置失败:', error);
            throw error;
        }
    }

    // --- 数据备份和恢复 ---

    /**
     * 创建数据备份
     * @returns {Object} 备份数据对象
     */
    createBackup() {
        try {
            const backupData = {
                medications: this.getAllMedications(),
                records: this.getRecords(),
                settings: this.getSettings(),
                delays: this.getDelays(),
                backupDate: new Date().toISOString(),
                version: '1.0'
            };

            // 保存备份到本地存储
            const backupKey = `backup_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backupData));

            // 记录备份时间戳
            const backupTimestamps = JSON.parse(localStorage.getItem(this.BACKUP_KEY) || '[]');
            backupTimestamps.push({
                key: backupKey,
                date: new Date().toISOString()
            });
            localStorage.setItem(this.BACKUP_KEY, JSON.stringify(backupTimestamps));

            return backupData;
        } catch (error) {
            console.error('创建备份失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有备份记录
     * @returns {Array} 备份记录数组
     */
    getBackups() {
        try {
            const backupTimestamps = JSON.parse(localStorage.getItem(this.BACKUP_KEY) || '[]');
            return backupTimestamps.map(backup => {
                try {
                    const backupData = JSON.parse(localStorage.getItem(backup.key) || '{}');
                    return {
                        ...backup,
                        medicationsCount: backupData.medications?.length || 0,
                        recordsCount: backupData.records?.length || 0
                    };
                } catch (error) {
                    return null;
                }
            }).filter(Boolean);
        } catch (error) {
            console.error('获取备份记录失败:', error);
            return [];
        }
    }

    /**
     * 从备份恢复数据
     * @param {string} backupKey - 备份键名
     * @returns {boolean} 是否恢复成功
     */
    restoreFromBackup(backupKey) {
        try {
            const backupData = JSON.parse(localStorage.getItem(backupKey) || '{}');
            
            if (!backupData || !backupData.version) {
                throw new Error('无效的备份数据');
            }

            // 验证备份数据完整性
            if (!backupData.medications || !backupData.records || !backupData.settings) {
                throw new Error('备份数据不完整');
            }

            // 验证数据格式
            const medicationsValid = backupData.medications.every(med => this.validateMedicationData(med));
            const recordsValid = backupData.records.every(rec => this.validateRecordData(rec));

            if (!medicationsValid || !recordsValid) {
                throw new Error('备份数据格式无效');
            }

            // 恢复数据
            this.saveMedications(backupData.medications);
            localStorage.setItem(this.RECORDS_KEY, JSON.stringify(backupData.records));
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(backupData.settings));
            localStorage.setItem(this.DELAYS_KEY, JSON.stringify(backupData.delays || {}));

            return true;
        } catch (error) {
            console.error('从备份恢复数据失败:', error);
            return false;
        }
    }

    /**
     * 删除备份
     * @param {string} backupKey - 备份键名
     * @returns {boolean} 是否删除成功
     */
    deleteBackup(backupKey) {
        try {
            // 删除备份数据
            localStorage.removeItem(backupKey);

            // 从备份记录中移除
            const backupTimestamps = JSON.parse(localStorage.getItem(this.BACKUP_KEY) || '[]');
            const filteredTimestamps = backupTimestamps.filter(backup => backup.key !== backupKey);
            localStorage.setItem(this.BACKUP_KEY, JSON.stringify(filteredTimestamps));

            return true;
        } catch (error) {
            console.error('删除备份失败:', error);
            return false;
        }
    }

    /**
     * 清理旧备份
     * @param {number} keepCount - 保留的备份数量
     * @returns {number} 清理的备份数量
     */
    cleanupOldBackups(keepCount = 5) {
        try {
            const backups = this.getBackups();
            const sortedBackups = backups.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            if (sortedBackups.length <= keepCount) {
                return 0;
            }

            const backupsToDelete = sortedBackups.slice(keepCount);
            let deletedCount = 0;

            backupsToDelete.forEach(backup => {
                if (this.deleteBackup(backup.key)) {
                    deletedCount++;
                }
            });

            return deletedCount;
        } catch (error) {
            console.error('清理旧备份失败:', error);
            return 0;
        }
    }

    // --- 数据统计和分析 ---

    /**
     * 计算用药依从率
     * @param {string} medicationId - 用药提醒ID (可选，如果不传则计算总体依从率)
     * @returns {Object} 依从率统计对象
     */
    calculateAdherenceRate(medicationId = null) {
        try {
            const records = medicationId 
                ? this.getMedicationRecords(medicationId)
                : this.getRecords();
            
            const totalRecords = records.length;
            const takenRecords = records.filter(r => r.action === 'taken').length;
            
            const adherenceRate = totalRecords > 0 ? (takenRecords / totalRecords) * 100 : 0;
            
            // 按月份统计
            const monthlyStats = this.getMonthlyAdherenceStats(records);
            
            return {
                totalRecords,
                takenRecords,
                adherenceRate: parseFloat(adherenceRate.toFixed(2)),
                monthlyStats
            };
        } catch (error) {
            console.error('计算用药依从率失败:', error);
            return {
                totalRecords: 0,
                takenRecords: 0,
                adherenceRate: 0,
                monthlyStats: {}
            };
        }
    }

    /**
     * 获取月度依从率统计
     * @param {Array} records - 记录数组
     * @returns {Object} 月度统计对象
     */
    getMonthlyAdherenceStats(records) {
        const monthlyStats = {};
        
        records.forEach(record => {
            const date = new Date(record.timestamp);
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            
            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = {
                    total: 0,
                    taken: 0
                };
            }
            
            monthlyStats[monthKey].total++;
            if (record.action === 'taken') {
                monthlyStats[monthKey].taken++;
            }
        });
        
        // 计算每月依从率
        Object.keys(monthlyStats).forEach(month => {
            const stat = monthlyStats[month];
            stat.adherenceRate = stat.total > 0 ? parseFloat(((stat.taken / stat.total) * 100).toFixed(2)) : 0;
        });
        
        return monthlyStats;
    }

    /**
     * 获取数据统计信息
     * @returns {Object} 统计信息对象
     */
    getStats() {
        try {
            const medications = this.getAllMedications();
            const records = this.getRecords();
            const delays = this.getDelays();
            
            // 计算总体依从率
            const overallAdherence = this.calculateAdherenceRate();
            
            // 按时间段统计用药
            const timeSlotStats = {
                morning: medications.filter(m => m.timeOfDay === 'morning').length,
                noon: medications.filter(m => m.timeOfDay === 'noon').length,
                evening: medications.filter(m => m.timeOfDay === 'evening').length
            };
            
            // 按频次统计用药
            const frequencyStats = {
                once: medications.filter(m => m.frequency === 'once').length,
                daily: medications.filter(m => m.frequency === 'daily').length,
                weekly: medications.filter(m => m.frequency === 'weekly').length,
                custom: medications.filter(m => m.frequency === 'custom').length
            };
            
            // 最近记录统计
            const now = new Date();
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(now.getDate() - 7);
            
            const recentRecords = records.filter(r => 
                new Date(r.timestamp) >= oneWeekAgo
            );
            
            const recentAdherence = recentRecords.length > 0 
                ? {
                    total: recentRecords.length,
                    taken: recentRecords.filter(r => r.action === 'taken').length,
                    rate: parseFloat(((recentRecords.filter(r => r.action === 'taken').length / recentRecords.length) * 100).toFixed(2))
                }
                : { total: 0, taken: 0, rate: 0 };
            
            return {
                totalMedications: medications.length,
                activeMedications: medications.filter(m => m.enabled).length,
                totalRecords: records.length,
                pendingDelays: Object.keys(delays).length,
                takenRecords: records.filter(r => r.action === 'taken').length,
                delayedRecords: records.filter(r => r.action === 'delayed').length,
                cancelledRecords: records.filter(r => r.action === 'cancelled').length,
                overallAdherenceRate: overallAdherence.adherenceRate,
                timeSlotStats,
                frequencyStats,
                recentWeekStats: recentAdherence,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('获取统计数据失败:', error);
            return {};
        }
    }

    // --- 数据清理 ---

    /**
     * 清理过期记录
     * @param {number} daysToKeep - 保留天数，默认365天
     * @returns {number} 清理的记录数量
     */
    cleanupExpiredRecords(daysToKeep = 365) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const records = this.getRecords();
            const initialCount = records.length;
            
            const filteredRecords = records.filter(record => {
                const recordDate = new Date(record.timestamp);
                return recordDate >= cutoffDate;
            });
            
            if (filteredRecords.length !== initialCount) {
                localStorage.setItem(this.RECORDS_KEY, JSON.stringify(filteredRecords));
            }
            
            return initialCount - filteredRecords.length;
        } catch (error) {
            console.error('清理过期记录失败:', error);
            return 0;
        }
    }

    /**
     * 清理无效的延迟设置
     * @returns {number} 清理的延迟设置数量
     */
    cleanupInvalidDelays() {
        try {
            const delays = this.getDelays();
            const medications = this.getAllMedications();
            const medicationIds = new Set(medications.map(m => m.id));
            
            const initialCount = Object.keys(delays).length;
            
            // 移除不存在的用药提醒对应的延迟设置
            const validDelays = {};
            Object.keys(delays).forEach(key => {
                if (medicationIds.has(key)) {
                    validDelays[key] = delays[key];
                }
            });
            
            if (Object.keys(validDelays).length !== initialCount) {
                localStorage.setItem(this.DELAYS_KEY, JSON.stringify(validDelays));
            }
            
            return initialCount - Object.keys(validDelays).length;
        } catch (error) {
            console.error('清理无效延迟设置失败:', error);
            return 0;
        }
    }

    /**
     * 清理数据（包括过期记录和无效延迟设置）
     * @returns {Object} 清理结果
     */
    cleanupData() {
        try {
            const expiredRecordsCleaned = this.cleanupExpiredRecords();
            const invalidDelaysCleaned = this.cleanupInvalidDelays();
            
            return {
                expiredRecordsCleaned,
                invalidDelaysCleaned,
                totalCleaned: expiredRecordsCleaned + invalidDelaysCleaned,
                cleanedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('清理数据失败:', error);
            return {
                expiredRecordsCleaned: 0,
                invalidDelaysCleaned: 0,
                totalCleaned: 0,
                cleanedAt: new Date().toISOString()
            };
        }
    }

    /**
     * 定期清理和备份任务调度
     */
    scheduleCleanupAndBackup() {
        try {
            // 立即执行一次清理
            this.cleanupData();
            
            // 定期清理任务
            setInterval(() => {
                this.cleanupData();
            }, this.CLEANUP_INTERVAL);
            
            // 定期备份任务
            setInterval(() => {
                this.createBackup();
                // 清理旧备份，只保留最近5个
                this.cleanupOldBackups(5);
            }, this.BACKUP_INTERVAL);
        } catch (error) {
            console.error('调度清理和备份任务失败:', error);
        }
    }

    // --- 数据导出和导入 ---

    /**
     * 导出所有数据
     * @returns {Object} 包含所有数据的对象
     */
    exportData() {
        try {
            return {
                medications: this.getAllMedications(),
                records: this.getRecords(),
                settings: this.getSettings(),
                delays: this.getDelays(),
                version: '1.0',
                exportedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('导出数据失败:', error);
            return {};
        }
    }

    /**
     * 导入数据
     * @param {Object} data - 要导入的数据对象
     * @returns {boolean} 是否导入成功
     */
    importData(data) {
        try {
            if (!data || !data.version) {
                throw new Error('无效的导入数据格式');
            }

            // 验证数据完整性
            if (!data.medications || !data.records || !data.settings) {
                throw new Error('导入数据不完整');
            }

            // 验证数据格式
            const medicationsValid = data.medications.every(med => this.validateMedicationData(med));
            const recordsValid = data.records.every(rec => this.validateRecordData(rec));

            if (!medicationsValid || !recordsValid) {
                throw new Error('导入数据格式无效');
            }

            // 导入数据
            this.saveMedications(data.medications);
            localStorage.setItem(this.RECORDS_KEY, JSON.stringify(data.records));
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(data.settings));
            localStorage.setItem(this.DELAYS_KEY, JSON.stringify(data.delays || {}));

            // 创建导入数据的备份
            this.createBackup();

            return true;
        } catch (error) {
            console.error('导入数据失败:', error);
            return false;
        }
    }

    // --- 数据清理和维护 ---

    /**
     * 清空所有数据
     */
    clearAllData() {
        try {
            localStorage.removeItem(this.MEDICATIONS_KEY);
            localStorage.removeItem(this.RECORDS_KEY);
            localStorage.removeItem(this.SETTINGS_KEY);
            localStorage.removeItem(this.DELAYS_KEY);
            
            // 清理备份数据
            const backupTimestamps = JSON.parse(localStorage.getItem(this.BACKUP_KEY) || '[]');
            backupTimestamps.forEach(backup => {
                localStorage.removeItem(backup.key);
            });
            localStorage.removeItem(this.BACKUP_KEY);
        } catch (error) {
            console.error('清空所有数据失败:', error);
        }
    }
}

// 创建全局存储管理器实例
const storage = new StorageManager();

// 在 storage.js 中添加删除特定时间提醒的方法
/**
 * 删除特定用药提醒中的某个时间点
 * @param {string} medicationId - 用药提醒ID
 * @param {string} timeToRemove - 要删除的时间点（格式 HH:MM）
 * @param {string} timeSlotToRemove - 要删除的时间段
 * @returns {boolean} 是否删除成功
 */
deleteMedicationTime(medicationId, timeToRemove, timeSlotToRemove) {
    try {
        const medications = this.getAllMedications();
        const medicationIndex = medications.findIndex(m => m.id === medicationId);
        
        if (medicationIndex === -1) {
            return false;
        }
        
        // 过滤掉要删除的时间点
        const updatedMedication = { ...medications[medicationIndex] };
        updatedMedication.times = updatedMedication.times.filter(timeEntry => 
            !(timeEntry.time === timeToRemove && timeEntry.timeSlot === timeSlotToRemove)
        );
        
        // 如果没有剩余时间点，删除整个用药提醒
        if (updatedMedication.times.length === 0) {
            medications.splice(medicationIndex, 1);
        } else {
            medications[medicationIndex] = updatedMedication;
        }
        
        this.saveMedications(medications);
        return true;
    } catch (error) {
        console.error('删除用药时间失败:', error);
        return false;
    }
}

// 更新 createMedicationElement 方法
createMedicationElement(medication, timeEntry) {
    const div = document.createElement('div');
    div.className = 'medication-item';
    // 使用 medication.id 和时间组合成唯一 ID
    div.dataset.id = `${medication.id}_${timeEntry.time}_${timeEntry.timeSlot}`;

    const frequencyText = this.getFrequencyText(medication);
    const timeText = timeEntry.time;

    div.innerHTML = `
        <div class="medication-info">
            <h3>${this.escapeHtml(medication.name)}</h3>
            <p><i class="fas fa-clock"></i> ${timeText} ${frequencyText}</p>
            ${medication.notes ? `<p><i class="fas fa-sticky-note"></i> ${this.escapeHtml(medication.notes)}</p>` : ''}
        </div>
        <div class="medication-actions">
            <button class="btn btn-secondary edit-btn" title="编辑">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-danger delete-btn" title="删除">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    // 添加编辑事件监听
    const editBtn = div.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editMedication(medication.id); // 传递完整的用药提醒 ID
        });
    }

    // 添加删除事件监听
    const deleteBtn = div.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 传递特定时间点信息给删除函数
            this.deleteMedication(medication.id, timeEntry.time, timeEntry.timeSlot);
        });
    }

    return div;
}
