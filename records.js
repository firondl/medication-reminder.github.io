// 用药记录页面逻辑
class RecordsPage {
    constructor() {
        this.storage = storage;
        this.currentFilters = {
            startDate: '',
            endDate: '',
            medication: ''
        };
        this.initializePage();
    }

    initializePage() {
        this.setupEventListeners();
        this.loadMedicationsFilter();
        this.setupDefaultDates();
        this.applyFilters();
    }

    setupEventListeners() {
        // 筛选相关
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // 导出功能
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportRecords();
        });

        // 删除功能
        document.getElementById('deleteAllBtn').addEventListener('click', () => {
            this.showDeleteModal();
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.deleteAllRecords();
        });

        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            this.hideDeleteModal();
        });

        // 输入框变化实时筛选
        document.getElementById('startDate').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('endDate').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('medicationFilter').addEventListener('change', () => {
            this.applyFilters();
        });
    }

    setupDefaultDates() {
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        
        document.getElementById('startDate').value = oneWeekAgo.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
        
        this.currentFilters.startDate = oneWeekAgo.toISOString().split('T')[0];
        this.currentFilters.endDate = today.toISOString().split('T')[0];
    }

    loadMedicationsFilter() {
        const medications = this.storage.getAllMedications();
        const filter = document.getElementById('medicationFilter');
        
        // 清空现有选项（保留"所有药品"）
        while (filter.children.length > 1) {
            filter.removeChild(filter.lastChild);
        }
        
        // 添加药品选项
        medications.forEach(med => {
            const option = document.createElement('option');
            option.value = med.id;
            option.textContent = med.name;
            filter.appendChild(option);
        });
    }

    applyFilters() {
        this.updateFilters();
        const filteredRecords = this.getFilteredRecords();
        this.displayRecords(filteredRecords);
    }

    updateFilters() {
        this.currentFilters = {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            medication: document.getElementById('medicationFilter').value
        };
    }

    getFilteredRecords() {
        let records = this.storage.getRecords();
        const medications = this.storage.getAllMedications();
        
        // 将药品信息合并到记录中
        records = records.map(record => {
            const medication = medications.find(m => m.id === record.medicationId);
            return {
                ...record,
                medicationName: medication ? medication.name : '未知药品',
                medication: medication
            };
        });

        // 应用筛选条件
        return records.filter(record => {
            const recordDate = record.timestamp.split('T')[0];
            
            // 日期筛选
            if (this.currentFilters.startDate && recordDate < this.currentFilters.startDate) {
                return false;
            }
            
            if (this.currentFilters.endDate && recordDate > this.currentFilters.endDate) {
                return false;
            }
            
            // 药品筛选
            if (this.currentFilters.medication && record.medicationId !== this.currentFilters.medication) {
                return false;
            }
            
            // 只显示taken和cancelled记录（排除delayed）
            if (record.action === 'delayed') {
                return false;
            }
            
            return true;
        });
    }

    displayRecords(records) {
        const list = document.getElementById('recordsList');
        
        if (records.length === 0) {
            list.innerHTML = `
                <div class="no-records">
                    <i class="fas fa-inbox"></i>
                    <h3>暂无记录</h3>
                    <p>没有找到匹配的用药记录</p>
                </div>
            `;
            return;
        }

        // 按时间排序（最新的在前）
        records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 生成文本格式的记录清单
        let html = '<div class="text-records">';
        
        records.forEach(record => {
            const date = new Date(record.timestamp);
            const dateStr = date.toLocaleDateString('zh-CN');
            const timeStr = date.toLocaleTimeString('zh-CN');
            
            const actionText = record.action === 'taken' ? '服用' : '取消';
            
            html += `
                <div class="text-record-item">
                    <span class="record-date">${dateStr}</span>
                    <span class="record-time">${timeStr}</span>
                    <span class="record-medication">${record.medicationName}</span>
                    <span class="record-action">${actionText}</span>
                </div>
            `;
        });
        
        html += '</div>';
        list.innerHTML = html;
    }

    clearFilters() {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('medicationFilter').value = '';
        this.applyFilters();
    }

    exportRecords() {
        const records = this.getFilteredRecords();
        
        if (records.length === 0) {
            alert('没有可导出的记录');
            return;
        }

        // 创建文本格式的记录清单
        let text = '用药记录清单\n\n';
        text += '导出时间: ' + new Date().toLocaleString('zh-CN') + '\n';
        text += '记录总数: ' + records.length + '\n\n';
        
        records.forEach(record => {
            const date = new Date(record.timestamp);
            const dateStr = date.toLocaleDateString('zh-CN');
            const timeStr = date.toLocaleTimeString('zh-CN');
            
            const actionText = record.action === 'taken' ? '服用' : '取消';
            
            text += `[${dateStr} ${timeStr}] ${record.medicationName} - ${actionText}\n`;
        });
        
        // 创建下载链接
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `用药记录清单_${new Date().toISOString().split('T')[0]}.txt`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 显示成功消息
        this.showMessage(`成功导出 ${records.length} 条记录`, 'success');
    }

    showDeleteModal() {
        document.getElementById('deleteModal').style.display = 'flex';
    }

    hideDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
    }

    deleteAllRecords() {
        // 清空记录
        localStorage.removeItem('medication_records');
        this.hideDeleteModal();
        
        // 重新加载页面数据
        this.applyFilters();
        
        // 显示成功消息
        this.showMessage('所有记录已成功删除', 'success');
    }

    showMessage(message, type = 'info') {
        // 移除现有消息
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 创建新消息
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 'info-circle';
        
        messageDiv.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        // 添加样式
        Object.assign(messageDiv.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'success' ? '#2ecc71' : 
                       type === 'error' ? '#e74c3c' : '#3498db',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '5px',
            zIndex: '10000',
            animation: 'slideInRight 0.3s ease',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px'
        });
        
        document.body.appendChild(messageDiv);
        
        // 3秒后自动消失
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 300);
            }
        }, 3000);
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .text-records {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .text-record-item {
        background: var(--bg-secondary);
        padding: 15px;
        border-radius: var(--radius-medium);
        border-left: 4px solid var(--primary-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
    }
    
    .text-record-item span {
        flex: 1;
        min-width: 100px;
    }
    
    .record-action {
        font-weight: bold;
        color: var(--success-color);
    }
    
    .record-action[data-action="cancelled"] {
        color: var(--danger-color);
    }
    
    .filter-group {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
        flex-wrap: wrap;
    }
    
    .filter-group label {
        display: flex;
        align-items: center;
        gap: 5px;
        font-weight: 500;
    }
    
    .filter-group input,
    .filter-group select {
        padding: 8px 12px;
        border: 2px solid var(--border-color);
        border-radius: var(--radius-medium);
        font-size: var(--font-base);
    }
    
    .no-records {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
    }
    
    .no-records i {
        font-size: 3em;
        margin-bottom: 10px;
        opacity: 0.5;
    }
    
    .no-records p {
        margin: 0;
        font-size: 1em;
    }
    
    @media (max-width: 768px) {
        .text-record-item {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .filter-group {
            flex-direction: column;
            align-items: stretch;
        }
    }
`;
document.head.appendChild(style);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.recordsPage = new RecordsPage();
});