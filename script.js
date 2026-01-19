// 主应用逻辑
class MedicationReminderApp {
    constructor() {
        this.storage = storage;
        this.currentEditingId = null;
        this.reminderCheckInterval = null;
        this.audioContext = null;
        this.addEventListener = this.addEventListener.bind(this); // 绑定this
        console.log("MedicationReminderApp 初始化开始");
        this.initializeApp();
    }

    initializeApp() {
        console.log("开始初始化应用");
        this.setupEventListeners();
        this.updateCurrentTime();
        this.loadMedications();
        this.startReminderCheck();
        this.initAudioContext();
        this.initializeTimeInputs();
        
        // 请求通知权限
        this.requestNotificationPermission();
        
        console.log("应用初始化完成");
    }

    // 请求通知权限
    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('通知权限已授予');
            } else {
                console.log('通知权限被拒绝');
            }
        }
    }

    // 添加事件监听器的辅助函数
    addEventListener(element, event, handler) {
        if (element) {
            console.log(`为元素添加事件监听器: ${element.id || element.tagName}, 事件: ${event}`);
            element.addEventListener(event, handler);
            return true;
        } else {
            console.warn(`元素不存在，无法添加事件监听器: ${element}`);
            return false;
        }
    }

    setupEventListeners() {
        console.log("开始设置事件监听器");
        
        // 添加按钮点击事件 - 现在只有一个通用按钮
        const addBtn = document.getElementById('addMedicationBtn');
        console.log("查找添加按钮:", addBtn);
        if (addBtn) {
            console.log("找到添加按钮，添加点击事件");
            this.addEventListener(addBtn, 'click', (e) => {
                console.log("添加按钮被点击");
                e.stopPropagation(); // 防止事件冒泡
                this.showAddModal();
            });
        } else {
            console.error("未找到添加按钮，ID: addMedicationBtn");
            // 尝试查找所有按钮并打印它们的ID
            const buttons = document.querySelectorAll('button');
            console.log("页面中的所有按钮:", Array.from(buttons).map(btn => btn.id || btn.textContent));
        }

        // 表单提交
        const form = document.getElementById('medicationForm');
        if (form) {
            this.addEventListener(form, 'submit', (e) => {
                e.preventDefault();
                this.saveMedication();
            });
        }

        // 取消按钮
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            this.addEventListener(cancelBtn, 'click', (e) => {
                e.stopPropagation(); // 防止事件冒泡
                this.hideAddModal();
            });
        }

        // 频率选择变化
        const frequencySelect = document.getElementById('medFrequency');
        if (frequencySelect) {
            this.addEventListener(frequencySelect, 'change', (e) => {
                e.stopPropagation(); // 防止事件冒泡
                this.toggleCustomInterval(e.target.value);
            });
        }

        // 添加时间按钮
        const addTimeBtn = document.getElementById('addTimeBtn');
        if (addTimeBtn) {
            this.addEventListener(addTimeBtn, 'click', (e) => {
                e.stopPropagation(); // 防止事件冒泡导致模态框关闭
                this.addTimeInput();
            });
        }

        // 确认服药
        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
            this.addEventListener(confirmBtn, 'click', (e) => {
                e.stopPropagation();
                this.confirmMedication();
            });
        }

        // 延迟按钮
        const delayBtn = document.getElementById('delayBtn');
        if (delayBtn) {
            this.addEventListener(delayBtn, 'click', (e) => {
                e.stopPropagation();
                this.showDelayModal();
            });
        }

        // 延迟设置
        const setDelayBtn = document.getElementById('setDelayBtn');
        if (setDelayBtn) {
            this.addEventListener(setDelayBtn, 'click', (e) => {
                e.stopPropagation();
                this.setDelay();
            });
        }

        // 取消用药
        const cancelMedBtn = document.getElementById('cancelMedBtn');
        if (cancelMedBtn) {
            this.addEventListener(cancelMedBtn, 'click', (e) => {
                e.stopPropagation();
                this.cancelMedication();
            });
        }

        // 返回按钮
        const closeDelayBtn = document.getElementById('closeDelayBtn');
        if (closeDelayBtn) {
            this.addEventListener(closeDelayBtn, 'click', (e) => {
                e.stopPropagation();
                this.hideDelayModal();
            });
        }

        // 模态框关闭事件
        const modals = document.querySelectorAll('.modal');
        console.log(`找到 ${modals.length} 个模态框`);
        modals.forEach(modal => {
            const closeModalHandler = (e) => {
                // 只有点击背景才关闭，点击内容不关闭
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            };
            this.addEventListener(modal, 'click', closeModalHandler);
        });
        
        console.log("事件监听器设置完成");
    }

    // 添加时间输入行
    addTimeInput() {
        const container = document.getElementById('timeInputsContainer');
        const timeInputGroup = document.createElement('div');
        timeInputGroup.className = 'time-input-group';
        timeInputGroup.innerHTML = `
            <input type="time" class="med-time-input" required>
            <select class="med-time-slot" required>
                <option value="morning">早晨</option>
                <option value="noon">中午</option>
                <option value="evening">晚上</option>
            </select>
            <button type="button" class="btn btn-secondary remove-time-btn" title="删除时间">
                <i class="fas fa-minus"></i>
            </button>
        `;
        container.appendChild(timeInputGroup);
        
        // 为新添加的删除按钮添加事件
        const removeBtn = timeInputGroup.querySelector('.remove-time-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止事件冒泡
                const container = document.getElementById('timeInputsContainer');
                if (container.children.length > 1) { // 确保至少保留一个时间输入
                    container.removeChild(timeInputGroup);
                } else {
                    // 如果只剩一个时间输入，则清空该输入而不是删除整个组
                    const inputs = timeInputGroup.querySelectorAll('input, select');
                    inputs.forEach(input => {
                        if (input.tagName === 'INPUT') {
                            input.value = '';
                        } else if (input.tagName === 'SELECT') {
                            input.selectedIndex = 0;
                        }
                    });
                }
            });
        }
    }

    // 初始化时间输入功能
    initializeTimeInputs() {
        // 这里只处理初始的删除按钮，动态添加的在addTimeInput中处理
    }

    showAddModal() {
        console.log("尝试显示添加模态框");
        try {
            const modal = document.getElementById('addModal');
            console.log("查找添加模态框:", modal);
            if (modal) {
                // 清空表单
                const form = document.getElementById('medicationForm');
                if (form) {
                    form.reset();
                }
                
                // 清空时间输入容器并添加一个默认时间输入
                const container = document.getElementById('timeInputsContainer');
                if (container) {
                    container.innerHTML = '';
                    const defaultTimeGroup = document.createElement('div');
                    defaultTimeGroup.className = 'time-input-group';
                    defaultTimeGroup.innerHTML = `
                        <input type="time" class="med-time-input" required>
                        <select class="med-time-slot" required>
                            <option value="morning">早晨</option>
                            <option value="noon">中午</option>
                            <option value="evening">晚上</option>
                        </select>
                        <button type="button" class="btn btn-secondary remove-time-btn" title="删除时间">
                            <i class="fas fa-minus"></i>
                        </button>
                    `;
                    container.appendChild(defaultTimeGroup);
                    
                    // 为默认删除按钮添加事件
                    const removeBtn = defaultTimeGroup.querySelector('.remove-time-btn');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', (e) => {
                            e.stopPropagation(); // 防止事件冒泡
                            const container = document.getElementById('timeInputsContainer');
                            if (container.children.length > 1) {
                                container.removeChild(defaultTimeGroup);
                            } else {
                                // 如果只剩一个时间输入，则清空该输入而不是删除整个组
                                const inputs = defaultTimeGroup.querySelectorAll('input, select');
                                inputs.forEach(input => {
                                    if (input.tagName === 'INPUT') {
                                        input.value = '';
                                    } else if (input.tagName === 'SELECT') {
                                        input.selectedIndex = 0;
                                    }
                                });
                            }
                        });
                    }
                    
                    // 设置默认时间为当前时间
                    const defaultTimeInput = container.querySelector('.med-time-input');
                    if (defaultTimeInput) {
                        const now = new Date();
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        defaultTimeInput.value = `${hours}:${minutes}`;
                    }
                }
                
                // 隐藏自定义间隔输入框
                const customGroup = document.getElementById('customIntervalGroup');
                if (customGroup) {
                    customGroup.style.display = 'none';
                }
                
                // 重置编辑状态
                this.currentEditingId = null;
                
                console.log("显示模态框");
                modal.style.display = 'flex';
                
                // 聚焦到药品名称输入框
                const nameInput = document.getElementById('medName');
                if (nameInput) {
                    nameInput.focus();
                }
            } else {
                console.error("未找到添加模态框，ID: addModal");
                // 查找页面上所有的模态框
                const allModals = document.querySelectorAll('.modal');
                console.log("页面中的所有模态框:", Array.from(allModals).map(m => m.id));
            }
        } catch (error) {
            console.error('显示添加模态框失败:', error);
            this.showError('无法显示添加用药界面');
        }
    }

    hideAddModal() {
        try {
            const modal = document.getElementById('addModal');
            if (modal) {
                modal.style.display = 'none';
            }
            
            // 重置表单
            const form = document.getElementById('medicationForm');
            if (form) {
                form.reset();
            }
            
            // 隐藏自定义间隔输入框
            const customGroup = document.getElementById('customIntervalGroup');
            if (customGroup) {
                customGroup.style.display = 'none';
            }
            
            this.currentEditingId = null;
        } catch (error) {
            console.error('隐藏添加模态框失败:', error);
        }
    }

    toggleCustomInterval(frequency) {
        try {
            const customGroup = document.getElementById('customIntervalGroup');
            if (customGroup) {
                customGroup.style.display = frequency === 'custom' ? 'block' : 'none';
            }
        } catch (error) {
            console.error('切换自定义间隔显示失败:', error);
        }
    }

    validateMedicationData(medication) {
        if (!medication.name || medication.name.trim() === '') {
            throw new Error('请输入药品名称');
        }
        
        if (!medication.times || medication.times.length === 0) {
            throw new Error('请至少设置一个提醒时间');
        }
        
        // 验证所有时间格式和时间段
        for (const timeEntry of medication.times) {
            if (!timeEntry.time || !timeEntry.timeSlot) {
                throw new Error('请填写所有时间及对应时间段');
            }
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(timeEntry.time)) {
                throw new Error('存在无效的时间格式');
            }
            if (!['morning', 'noon', 'evening'].includes(timeEntry.timeSlot)) {
                throw new Error('时间段必须是早晨、中午或晚上');
            }
        }
        
        if (!medication.frequency) {
            throw new Error('请选择提醒频次');
        }
        
        if (medication.frequency === 'custom') {
            const interval = parseInt(medication.customInterval);
            if (isNaN(interval) || interval <= 0) {
                throw new Error('请输入有效的自定义间隔天数');
            }
        }
        
        return true;
    }

    async saveMedication() {
        try {
            const medication = {
                name: document.getElementById('medName').value.trim(),
                times: Array.from(document.querySelectorAll('.time-input-group')).map(group => {
                    const timeInput = group.querySelector('.med-time-input');
                    const slotSelect = group.querySelector('.med-time-slot');
                    if (timeInput && slotSelect && timeInput.value && slotSelect.value) {
                        return {
                            time: timeInput.value,
                            timeSlot: slotSelect.value
                        };
                    }
                    return null;
                }).filter(timeEntry => timeEntry), // 过滤掉空的时间输入
                frequency: document.getElementById('medFrequency').value,
                notes: document.getElementById('medNotes').value.trim(),
                enabled: true
            };

            if (medication.frequency === 'custom') {
                medication.customInterval = parseInt(document.getElementById('customInterval').value) || 1;
            }

            // 验证数据
            this.validateMedicationData(medication);

            if (this.currentEditingId) {
                // 更新现有提醒
                const success = this.storage.updateMedication(this.currentEditingId, medication);
                if (success) {
                    this.showSuccess('用药提醒已更新');
                } else {
                    throw new Error('更新用药提醒失败');
                }
            } else {
                // 添加新提醒
                const id = this.storage.addMedication(medication);
                if (id) {
                    this.showSuccess('用药提醒已添加');
                } else {
                    throw new Error('添加用药提醒失败');
                }
            }

            this.loadMedications();
            this.hideAddModal();
        } catch (error) {
            console.error('保存用药提醒失败:', error);
            this.showError(error.message || '保存用药提醒时发生错误');
        }
    }

    loadMedications() {
        try {
            // 清空所有时间槽
            const timeSlots = ['morning', 'noon', 'evening'];
            timeSlots.forEach(timeSlot => {
                const listElement = document.getElementById(`${timeSlot}-list`);
                if (listElement) {
                    listElement.innerHTML = '';
                }
            });
            
            // 获取所有用药提醒
            const medications = this.storage.getAllMedications();
            
            // 将用药提醒分配到对应的时间槽
            medications.forEach(med => {
                // 为每个时间-时间段组合创建一个项目
                med.times.forEach(timeEntry => {
                    const listElement = document.getElementById(`${timeEntry.timeSlot}-list`);
                    if (listElement) {
                        const medElement = this.createMedicationElement(med, timeEntry.time);
                        listElement.appendChild(medElement);
                    }
                });
            });
            
            // 如果某个时间槽没有用药提醒，显示空状态
            timeSlots.forEach(timeSlot => {
                const listElement = document.getElementById(`${timeSlot}-list`);
                if (listElement && listElement.children.length === 0) {
                    listElement.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-prescription-bottle-alt"></i>
                            <p>暂无${this.getTimeSlotText(timeSlot)}用药</p>
                        </div>
                    `;
                }
            });
        } catch (error) {
            console.error('加载用药提醒失败:', error);
            this.showError('加载用药提醒时发生错误');
        }
    }

    getTimeSlotText(timeSlot) {
        const timeSlotMap = {
            'morning': '早晨',
            'noon': '中午',
            'evening': '晚上'
        };
        return timeSlotMap[timeSlot] || timeSlot;
    }

    createMedicationElement(medication, specificTime = null) {
        const div = document.createElement('div');
        div.className = 'medication-item';
        div.dataset.id = medication.id;

        const frequencyText = this.getFrequencyText(medication);
        const timeText = specificTime || medication.times[0].time;

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
                this.editMedication(medication.id);
            });
        }

        // 添加删除事件监听
        const deleteBtn = div.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMedication(medication.id);
            });
        }

        return div;
    }

    getFrequencyText(medication) {
        switch (medication.frequency) {
            case 'once': return '（单次）';
            case 'daily': return '（每天）';
            case 'weekly': return '（每周）';
            case 'custom': return `（每${medication.customInterval}天）`;
            default: return '';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    editMedication(id) {
        try {
            const medications = this.storage.getAllMedications();
            const medication = medications.find(m => m.id === id);
            
            if (!medication) {
                throw new Error('未找到指定的用药提醒');
            }
            
            this.currentEditingId = id;
            
            // 填充表单
            document.getElementById('medName').value = medication.name;
            document.getElementById('medFrequency').value = medication.frequency;
            document.getElementById('medNotes').value = medication.notes || '';
            
            // 填充时间输入
            const timeContainer = document.getElementById('timeInputsContainer');
            timeContainer.innerHTML = ''; // 清空现有时间输入
            
            // 添加时间输入
medication.times.forEach((timeEntry, index) => {
    const timeGroup = document.createElement('div');
    timeGroup.className = 'time-input-group';
    timeGroup.innerHTML = `
        <input type="time" class="med-time-input" value="${timeEntry.time}" required>
        <select class="med-time-slot" required>
            <option value="morning" ${timeEntry.timeSlot === 'morning' ? 'selected' : ''}>早晨</option>
            <option value="noon" ${timeEntry.timeSlot === 'noon' ? 'selected' : ''}>中午</option>
            <option value="evening" ${timeEntry.timeSlot === 'evening' ? 'selected' : ''}>晚上</option>
        </select>
        <button type="button" class="btn btn-secondary remove-time-btn" title="删除时间">
            <i class="fas fa-minus"></i>
        </button>
    `;
    timeContainer.appendChild(timeGroup);
    
    // 为删除按钮添加事件
    const removeBtn = timeGroup.querySelector('.remove-time-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止事件冒泡
            if (timeContainer.children.length > 1) { // 确保至少保留一个时间输入
                timeContainer.removeChild(timeGroup);
            } else {
                // 如果只剩一个时间输入，则清空该输入而不是删除整个组
                const inputs = timeGroup.querySelectorAll('input, select');
                inputs.forEach(input => {
                    if (input.tagName === 'INPUT') {
                        input.value = '';
                    } else if (input.tagName === 'SELECT') {
                        input.selectedIndex = 0;
                    }
                });
            }
        });  // ← 这里结束箭头函数
    }  // ← 这里结束if语句
});  // ← 这里结束forEach回调函数
            
            // 处理自定义间隔
            if (medication.frequency === 'custom' && medication.customInterval) {
                document.getElementById('customInterval').value = medication.customInterval;
            }
            
            this.toggleCustomInterval(medication.frequency);
            document.getElementById('addModal').style.display = 'flex';
        } catch (error) {
            console.error('编辑用药提醒失败:', error);
            this.showError(error.message || '编辑用药提醒时发生错误');
        }
    }

    deleteMedication(id) {
        try {
            if (confirm('确定要删除这个用药提醒吗？此操作不可撤销。')) {
                const success = this.storage.deleteMedication(id);
                if (success) {
                    this.loadMedications();
                    this.showSuccess('用药提醒已删除');
                } else {
                    throw new Error('删除用药提醒失败');
                }
            }
        } catch (error) {
            console.error('删除用药提醒失败:', error);
            this.showError(error.message || '删除用药提醒时发生错误');
        }
    }

    updateCurrentTime() {
        try {
            const timeElement = document.getElementById('currentTime');
            if (timeElement) {
                const updateTime = () => {
                    const now = new Date();
                    const timeString = now.toLocaleString('zh-CN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    timeElement.textContent = timeString;
                };
                
                updateTime();
                setInterval(updateTime, 1000);
            }
        } catch (error) {
            console.error('更新时间显示失败:', error);
        }
    }

    // 在 MedicationReminderApp 类中添加页面可见性检测
startReminderCheck() {
    try {
        // 清除之前的定时器
        if (this.reminderCheckInterval) {
            clearInterval(this.reminderCheckInterval);
        }
        
        // 每分钟检查一次
        this.reminderCheckInterval = setInterval(() => {
            this.checkReminders();
        }, 60000);
        
        // 页面可见性变化时也检查
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // 页面变为可见时立即检查
                this.checkReminders();
            }
        });
        
        // 立即检查一次
        this.checkReminders();
    } catch (error) {
        console.error('启动提醒检查失败:', error);
    }
}

    checkReminders() {
        try {
            const now = new Date();
            const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                               now.getMinutes().toString().padStart(2, '0');
            
            const medications = this.storage.getAllMedications();
            const delays = this.storage.getDelays();
            
            medications.forEach(med => {
                if (!med.enabled) return;
                
                // 检查是否有延迟提醒
                if (delays[med.id]) {
                    const delayTime = new Date(delays[med.id].delayTime);
                    const delayTimeString = delayTime.getHours().toString().padStart(2, '0') + ':' + 
                                          delayTime.getMinutes().toString().padStart(2, '0');
                    
                    if (delayTimeString === currentTime) {
                        this.showReminderModal(med, true);
                        // 清除延迟标记
                        this.storage.clearDelay(med.id);
                    }
                } else {
                    // 检查所有时间-时间段组合
                    const matchingTimeEntry = med.times.find(entry => entry.time === currentTime);
                    if (matchingTimeEntry && this.shouldRemindToday(med)) {
                        this.showReminderModal(med, false);
                    }
                }
            });
        } catch (error) {
            console.error('检查提醒失败:', error);
        }
    }

    shouldRemindToday(medication) {
        try {
            const now = new Date();
            const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const date = now.getDate();
            
            switch (medication.frequency) {
                case 'once':
                    // 单次提醒：只在创建日期当天提醒
                    const createdDate = new Date(medication.createdAt);
                    return createdDate.getDate() === date &&
                           createdDate.getMonth() === now.getMonth() &&
                           createdDate.getFullYear() === now.getFullYear();
                
                case 'daily':
                    // 每天都提醒
                    return true;
                
                case 'weekly':
                    // 每周提醒：简单实现，实际可以根据具体星期几来设置
                    return true; // 或者根据需要实现更复杂的逻辑
                
                case 'custom':
                    // 自定义间隔：根据创建日期计算
                    const created = new Date(medication.createdAt);
                    const diffTime = Math.abs(now - created);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    return diffDays % medication.customInterval === 0;
                
                default:
                    return true;
            }
        } catch (error) {
            console.error('判断是否需要提醒失败:', error);
            return false;
        }
    }

       // 修改 showReminderModal 方法，使其更适合移动设备
    showReminderModal(medication, isDelayed = false) {
        try {
            const contentElement = document.getElementById('reminderContent');
            const frequencyText = this.getFrequencyText(medication);
            
            // 获取所有时间点
            const times = medication.times.map(t => t.time).join(', ');
            
            if (contentElement) {
                contentElement.innerHTML = `
                    <div class="reminder-info">
                        <h3>${this.escapeHtml(medication.name)}</h3>
                        <p><i class="fas fa-clock"></i> 提醒时间：${times}</p>
                        <p>${frequencyText}</p>
                        ${medication.notes ? `<p><i class="fas fa-sticky-note"></i> ${this.escapeHtml(medication.notes)}</p>` : ''}
                        ${isDelayed ? '<p style="color: var(--warning-color);"><i class="fas fa-clock"></i> 这是延迟提醒</p>' : ''}
                    </div>
                `;
            }
            
            const modal = document.getElementById('reminderModal');
            if (modal) {
                modal.dataset.medicationId = medication.id;
                modal.dataset.isDelayed = isDelayed.toString();
                modal.style.display = 'flex';
                
                // 播放提醒音效
                this.playReminderSound();
                
                // 震动提醒（如果支持）
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
                
                // 自动聚焦到第一个按钮，便于快速操作
                setTimeout(() => {
                    const firstButton = document.querySelector('#reminderModal .modal-buttons button');
                    if (firstButton) firstButton.focus();
                }, 100);
            }
        } catch (error) {
            console.error('显示提醒模态框失败:', error);
        }
    }

    // 在 playReminderSound 方法中添加震动
    playReminderSound() {
        try {
            // 震动提醒（如果支持）
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
            
            if (!this.audioContext) return;
            
            // 创建简单的提醒音效
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.2);
        } catch (error) {
            console.warn('播放音效失败:', error);
        }
    }

    hideReminderModal() {
        try {
            const modal = document.getElementById('reminderModal');
            if (modal) {
                modal.style.display = 'none';
            }
        } catch (error) {
            console.error('隐藏提醒模态框失败:', error);
        }
    }

    async confirmMedication() {
        try {
            const modal = document.getElementById('reminderModal');
            if (!modal) return;
            
            const medicationId = modal.dataset.medicationId;
            const isDelayed = modal.dataset.isDelayed === 'true';
            
            if (medicationId) {
                // 记录用药行为 - 仅记录最终服药
                this.storage.recordMedication(medicationId, 'taken');
                
                if (isDelayed) {
                    this.storage.clearDelay(medicationId);
                }
                
                this.hideReminderModal();
                this.showSuccess('已确认服药');
            }
        } catch (error) {
            console.error('确认服药失败:', error);
            this.showError('确认服药时发生错误');
        }
    }

    showDelayModal() {
        try {
            this.hideReminderModal();
            const modal = document.getElementById('delayModal');
            if (modal) {
                modal.style.display = 'flex';
                
                // 设置默认延迟时间
                const delayInput = document.getElementById('delayMinutes');
                if (delayInput) {
                    delayInput.value = '5';
                    delayInput.focus();
                }
            }
        } catch (error) {
            console.error('显示延迟模态框失败:', error);
        }
    }

    hideDelayModal() {
        try {
            const modal = document.getElementById('delayModal');
            if (modal) {
                modal.style.display = 'none';
            }
        } catch (error) {
            console.error('隐藏延迟模态框失败:', error);
        }
    }

    async setDelay() {
        try {
            const modal = document.getElementById('reminderModal');
            const delayInput = document.getElementById('delayMinutes');
            
            if (!modal || !delayInput) return;
            
            const medicationId = modal.dataset.medicationId;
            const delayMinutes = parseInt(delayInput.value) || 5;
            
            if (medicationId) {
                // 获取当前用药信息
                const medications = this.storage.getAllMedications();
                const medication = medications.find(m => m.id === medicationId);
                
                if (medication) {
                    // 设置延迟提醒
                    this.storage.setDelay(medicationId, delayMinutes, new Date().toISOString());
                    
                    this.hideDelayModal();
                    this.showSuccess(`将在${delayMinutes}分钟后再次提醒`);
                }
            }
        } catch (error) {
            console.error('设置延迟失败:', error);
            this.showError('设置延迟时发生错误');
        }
    }

    async cancelMedication() {
        try {
            const modal = document.getElementById('reminderModal');
            if (!modal) return;
            
            const medicationId = modal.dataset.medicationId;
            
            if (medicationId) {
                // 记录取消行为 - 仅记录取消
                this.storage.recordMedication(medicationId, 'cancelled');
                
                this.hideDelayModal();
                this.hideReminderModal();
                this.showSuccess('已取消本次用药');
            }
        } catch (error) {
            console.error('取消用药失败:', error);
            this.showError('取消用药时发生错误');
        }
    }

    initAudioContext() {
        try {
            // 初始化音频上下文，用于播放音效
            if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        } catch (error) {
            console.warn('音频上下文初始化失败:', error);
        }
    }

    playReminderSound() {
        try {
            if (!this.audioContext) return;
            
            // 创建简单的提醒音效
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.2);
        } catch (error) {
            console.warn('播放音效失败:', error);
        }
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type = 'info') {
        try {
            // 移除现有消息
            const existingMessage = document.querySelector('.message-toast');
            if (existingMessage) {
                existingMessage.remove();
            }

            // 创建新消息
            const messageDiv = document.createElement('div');
            messageDiv.className = `message-toast ${type}`;
            messageDiv.classList.add('fade-in');
            
            const icons = {
                'success': 'check-circle',
                'error': 'exclamation-circle',
                'info': 'info-circle'
            };
            
            messageDiv.innerHTML = `
                <i class="fas fa-${icons[type] || icons.info}"></i>
                <span>${this.escapeHtml(message)}</span>
            `;
            
            // 添加样式
            Object.assign(messageDiv.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: type === 'success' ? 'var(--success-color)' : 
                           type === 'error' ? 'var(--danger-color)' : 'var(--primary-color)',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '8px',
                zIndex: '10000',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                maxWidth: '400px',
                wordBreak: 'break-word'
            });
            
            document.body.appendChild(messageDiv);
            
            // 3秒后自动消失
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.classList.add('fade-out');
                    setTimeout(() => {
                        if (messageDiv.parentNode) {
                            messageDiv.remove();
                        }
                    }, 300);
                }
            }, 3000);
        } catch (error) {
            console.error('显示消息失败:', error);
        }
    }
}

// 添加CSS动画
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    .fade-in {
        animation: fadeInSlideDown 0.3s ease-out;
    }
    
    .fade-out {
        animation: fadeOutSlideUp 0.3s ease-in forwards;
    }
    
    @keyframes fadeInSlideDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes fadeOutSlideUp {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
    }
    
    .empty-state i {
        font-size: 3em;
        margin-bottom: 10px;
        opacity: 0.5;
    }
    
    .empty-state p {
        margin: 0;
        font-size: 1em;
    }
    
    /* 多提醒时间输入组 */
    .time-input-group {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        align-items: center;
    }
    
    .time-input-group input,
    .time-input-group select {
        flex: 1;
    }
    
    .time-input-group .remove-time-btn {
        width: auto;
        padding: 8px 12px;
    }
    
    #addTimeBtn {
        width: 100%;
        margin-top: 10px;
    }
    
    /* 响应式调整 */
    @media (max-width: 768px) {
        .time-input-group {
            flex-direction: column;
            align-items: stretch;
        }
        
        .time-input-group .remove-time-btn {
            align-self: flex-end;
            width: auto;
        }
    }
`;
document.head.appendChild(toastStyle);

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM内容加载完成，开始初始化应用");
    try {
        window.app = new MedicationReminderApp();
        console.log("应用初始化完成");
    } catch (error) {
        console.error('应用初始化失败:', error);
        document.body.innerHTML = '<div style="padding: 20px; text-align: center;">应用加载失败，请打开控制台查看错误信息并刷新页面重试。</div>';
    }
});