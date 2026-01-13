// Современное VK мини-приложение для афиши концертов

class ConcertApp {
    constructor() {
        this.API_URL = 'https://permlive.ru/api/concerts';
        this.concerts = [];
        this.filteredConcerts = [];
        this.selectedDate = null;
        this.currentMonth = new Date();
        this.searchQuery = '';
        this.currentView = 'list';
        this.map = null;
        this.mapPlacemarks = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadConcerts();
        this.renderCalendar();
    }
    
    setupEventListeners() {
        // Поиск
        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('clear-search');
        
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            this.filterConcerts();
            
            if (this.searchQuery) {
                clearBtn.style.display = 'block';
            } else {
                clearBtn.style.display = 'none';
            }
        });
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            clearBtn.style.display = 'none';
            this.filterConcerts();
        });
        
        // Переключатель видов
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });
        
        // Календарь
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.renderCalendar();
        });
        
        document.getElementById('next-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.renderCalendar();
        });
    }
    
    switchView(view) {
        // Обновляем кнопки
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Скрываем все виды
        document.getElementById('calendar-view').style.display = 'none';
        document.getElementById('map-view').style.display = 'none';
        document.getElementById('concert-list').style.display = 'none';
        
        this.currentView = view;
        
        // Показываем нужный вид
        switch (view) {
            case 'calendar':
                document.getElementById('calendar-view').style.display = 'block';
                this.renderCalendar();
                break;
            case 'map':
                document.getElementById('map-view').style.display = 'block';
                this.initMap();
                break;
            case 'list':
            default:
                document.getElementById('concert-list').style.display = 'block';
                this.renderConcerts();
                break;
        }
    }
    
    async initMap() {
        if (this.map) {
            this.updateMapPlacemarks();
            return;
        }
        
        try {
            await new Promise((resolve) => {
                if (window.ymaps) {
                    resolve();
                } else {
                    window.ymapsReady = resolve;
                }
            });
            
            // Инициализируем карту (центр Перми)
            this.map = new ymaps.Map('map', {
                center: [58.0105, 56.2502],
                zoom: 12,
                controls: ['zoomControl']
            });
            
            // Добавляем метки концертов
            this.updateMapPlacemarks();
            
            // Обработчики кнопок карты
            document.getElementById('map-center').addEventListener('click', () => {
                this.map.setCenter([58.0105, 56.2502], 12);
            });
            
        } catch (error) {
            console.error('Ошибка инициализации карты:', error);
            document.getElementById('map').innerHTML = `
                <div class="error">
                    <div class="error-icon"><i class="fas fa-map"></i></div>
                    <div class="error-title">Карта недоступна</div>
                    <div class="error-message">Не удалось загрузить карту</div>
                </div>
            `;
        }
    }
    
    updateMapPlacemarks() {
        if (!this.map) return;
        
        // Очищаем старые метки
        this.mapPlacemarks.forEach(placemark => {
            this.map.geoObjects.remove(placemark);
        });
        this.mapPlacemarks = [];
        
        // Группируем концерты по местам
        const placeGroups = {};
        this.filteredConcerts.forEach(concert => {
            const placeName = concert.place?.name || concert.place || 'Неизвестное место';
            if (!placeGroups[placeName]) {
                placeGroups[placeName] = [];
            }
            placeGroups[placeName].push(concert);
        });
        
        // Создаем метки для каждого места
        Object.entries(placeGroups).forEach(([placeName, concerts]) => {
            // Используем координаты первого концерта или примерные координаты Перми
            const coords = this.getPlaceCoordinates(placeName);
            
            const placemark = new ymaps.Placemark(coords, {
                balloonContent: this.createBalloonContent(placeName, concerts)
            }, {
                preset: 'islands#redDotIcon',
                balloonPanelMaxMapArea: 0
            });
            
            this.map.geoObjects.add(placemark);
            this.mapPlacemarks.push(placemark);
        });
    }
    
    getPlaceCoordinates(placeName) {
        // Примерные координаты популярных площадок Перми
        const knownPlaces = {
            'БКЗ': [58.0105, 56.2502],
            'Театр-Театр': [58.0095, 56.2485],
            'Органный зал': [58.0115, 56.2520],
            'Пермская филармония': [58.0105, 56.2502],
            'Дом культуры': [58.0100, 56.2500],
            'Клуб': [58.0110, 56.2510]
        };
        
        // Ищем по ключевым словам
        for (const [key, coords] of Object.entries(knownPlaces)) {
            if (placeName.toLowerCase().includes(key.toLowerCase())) {
                return coords;
            }
        }
        
        // Возвращаем случайные координаты в пределах Перми
        const baseLat = 58.0105;
        const baseLng = 56.2502;
        const randomLat = baseLat + (Math.random() - 0.5) * 0.02;
        const randomLng = baseLng + (Math.random() - 0.5) * 0.04;
        
        return [randomLat, randomLng];
    }
    
    createBalloonContent(placeName, concerts) {
        const concertsHtml = concerts.slice(0, 5).map(concert => {
            const imageUrl = concert.small_pic || 'zhivoe_logo.jpg';
            const link = concert.slug ? `https://permlive.ru/event/${concert.slug}` : '#';
            const dateLabel = this.formatDate(concert.date, concert.time);
            
            return `
                <a href="${link}" class="map-balloon-concert" target="_blank">
                    <img src="${imageUrl}" alt="${concert.title}" class="map-balloon-concert-image" 
                         onerror="this.src='zhivoe_logo.jpg'">
                    <div class="map-balloon-concert-info">
                        <div class="map-balloon-concert-title">${concert.title}</div>
                        <div class="map-balloon-concert-date">${dateLabel}</div>
                    </div>
                </a>
            `;
        }).join('');
        
        const moreText = concerts.length > 5 ? `<div style="text-align: center; padding: 8px; color: #5f6368; font-size: 12px;">и ещё ${concerts.length - 5} концерт${concerts.length - 5 === 1 ? '' : concerts.length - 5 < 5 ? 'а' : 'ов'}</div>` : '';
        
        return `
            <div class="map-balloon">
                <div class="map-balloon-header">
                    <div class="map-balloon-title">${placeName}</div>
                    <div class="map-balloon-place">${concerts.length} концерт${concerts.length === 1 ? '' : concerts.length < 5 ? 'а' : 'ов'}</div>
                </div>
                <div class="map-balloon-body">
                    <div class="map-balloon-concerts">
                        ${concertsHtml}
                        ${moreText}
                    </div>
                </div>
            </div>
        `;
    }
    
    async loadConcerts() {
        const listElement = document.getElementById('concert-list');
        
        try {
            const response = await fetch(this.API_URL);
            if (!response.ok) throw new Error('Ошибка загрузки данных');
            
            let data = await response.json();
            if (!Array.isArray(data) || !data.length) {
                this.showEmptyState('Нет концертов', 'Концерты не найдены');
                return;
            }
            
            // Фильтруем будущие концерты
            data = this.filterFutureConcerts(data);
            
            // Сортируем концерты
            this.concerts = this.sortConcerts(data);
            this.filteredConcerts = [...this.concerts];
            
            this.renderConcerts();
            this.renderCalendar();
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.showError('Ошибка загрузки', 'Не удалось загрузить список концертов');
        }
    }
    
    filterFutureConcerts(concerts) {
        const now = new Date();
        return concerts.filter(concert => {
            if (!concert.date || !concert.time) return true;
            
            const [year, month, day] = concert.date.split('-').map(Number);
            const [hour, minute] = (concert.time || '00:00').split(':').map(Number);
            const concertDate = new Date(year, month - 1, day, hour, minute);
            
            return concertDate >= now;
        });
    }
    
    sortConcerts(concerts) {
        return concerts.slice().sort((a, b) => {
            // Сортировка по дате
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            
            // В пределах одной даты по рейтингу
            const aRating = parseFloat(a.rating || 0);
            const bRating = parseFloat(b.rating || 0);
            if (aRating > bRating) return -1;
            if (aRating < bRating) return 1;
            
            // По времени
            const aTime = this.parseTime(a.date, a.time);
            const bTime = this.parseTime(b.date, b.time);
            return aTime - bTime;
        });
    }
    
    parseTime(date, time) {
        if (!date || !time) return 0;
        const [h, m] = time.split(':');
        return new Date(date + 'T' + h.padStart(2, '0') + ':' + m.padStart(2, '0')).getTime();
    }
    
    filterConcerts() {
        let filtered = [...this.concerts];
        
        // Фильтр по поиску
        if (this.searchQuery) {
            filtered = filtered.filter(concert => {
                const title = (concert.title || '').toLowerCase();
                const place = (concert.place?.name || concert.place || '').toLowerCase();
                const tags = Array.isArray(concert.tags) ? 
                    concert.tags.map(tag => (tag.name || tag).toLowerCase()).join(' ') : '';
                
                return title.includes(this.searchQuery) || 
                       place.includes(this.searchQuery) || 
                       tags.includes(this.searchQuery);
            });
        }
        
        // Фильтр по дате
        if (this.selectedDate) {
            filtered = filtered.filter(concert => concert.date === this.selectedDate);
        }
        
        this.filteredConcerts = filtered;
        
        // Обновляем текущий вид
        switch (this.currentView) {
            case 'list':
                this.renderConcerts();
                break;
            case 'map':
                this.updateMapPlacemarks();
                break;
            case 'calendar':
                // Календарь не требует обновления при фильтрации
                break;
        }
        
        this.updateTitle();
    }
    
    renderConcerts() {
        const listElement = document.getElementById('concert-list');
        
        if (!this.filteredConcerts.length) {
            if (this.searchQuery || this.selectedDate) {
                this.showEmptyState('Ничего не найдено', 'Попробуйте изменить параметры поиска');
            } else {
                this.showEmptyState('Нет концертов', 'Концерты не найдены');
            }
            return;
        }
        
        const concertsHtml = this.filteredConcerts.map(concert => this.formatConcert(concert)).join('');
        listElement.innerHTML = concertsHtml;
        listElement.classList.add('fade-in');
        
        this.updateTitle();
    }
    
    formatConcert(concert) {
        const title = concert.title || 'Без названия';
        const date = concert.date || '';
        const time = (concert.time || '').slice(0, 5);
        const place = (concert.place?.name || concert.place || '');
        
        // Изображение
        let imageUrl = concert.small_pic || 'zhivoe_logo.jpg';
        if (!imageUrl || imageUrl.includes('camera_200.png')) {
            imageUrl = 'zhivoe_logo.jpg';
        }
        
        // Дата и время
        const dateLabel = this.formatDate(date, time);
        
        // Цена
        const priceTag = this.formatPrice(concert.price);
        
        // Теги
        const tags = this.formatTags(concert);
        
        // Рейтинг
        const rating = this.formatRating(concert.rating);
        
        // Ссылка
        const link = concert.slug ? `https://permlive.ru/event/${concert.slug}` : '#';
        
        // CSS классы
        const cardClasses = ['concert-card'];
        if (concert.is_new) cardClasses.push('new');
        if (parseFloat(concert.rating || 0) >= 5.0) cardClasses.push('featured');
        if (concert.is_cancelled) cardClasses.push('cancelled');
        
        return `
            <a href="${link}" class="${cardClasses.join(' ')}" target="_blank">
                <div class="concert-header">
                    <img src="${imageUrl}" alt="${title}" class="concert-image" 
                         onerror="this.src='zhivoe_logo.jpg'">
                    <div class="concert-info">
                        <div class="concert-title">${title}</div>
                        <div class="concert-meta">
                            <div class="concert-datetime">
                                <i class="fas fa-clock"></i>
                                ${dateLabel}
                            </div>
                            ${place ? `
                                <div class="concert-venue">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${place}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="concert-footer">
                    <div class="concert-tags">
                        ${tags}
                        ${priceTag}
                    </div>
                    ${rating}
                </div>
            </a>
        `;
    }
    
    formatDate(date, time) {
        if (!date) return '';
        
        const concertDate = new Date(date);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        let dateStr = '';
        if (concertDate.toDateString() === today.toDateString()) {
            dateStr = 'Сегодня';
        } else if (concertDate.toDateString() === tomorrow.toDateString()) {
            dateStr = 'Завтра';
        } else {
            const options = { weekday: 'short', day: 'numeric', month: 'short' };
            dateStr = concertDate.toLocaleDateString('ru-RU', options);
        }
        
        return time ? `${dateStr}, ${time}` : dateStr;
    }
    
    formatPrice(price) {
        if (price === 0 || price === '0' || price === null || price === undefined) {
            return '<span class="tag free">Бесплатно</span>';
        } else if (price > 0) {
            return `<span class="tag price">${price}₽</span>`;
        }
        return '';
    }
    
    formatTags(concert) {
        if (!Array.isArray(concert.tags) || !concert.tags.length) return '';
        
        // Показываем только первый тег
        const firstTag = concert.tags[0];
        const tagName = firstTag.name || firstTag;
        const extraCount = concert.tags.length - 1;
        
        let tagText = tagName;
        if (extraCount > 0) {
            tagText += ` +${extraCount}`;
        }
        
        return `<span class="tag genre">${tagText}</span>`;
    }
    
    formatRating(rating) {
        const ratingValue = parseFloat(rating || 0);
        if (ratingValue < 4.0) return '';
        
        const ratingClass = ratingValue >= 5.0 ? 'rating-high' : '';
        return `
            <div class="concert-rating ${ratingClass}">
                <i class="fas fa-star"></i>
                ${ratingValue.toFixed(1)}
            </div>
        `;
    }
    
    renderCalendar() {
        const titleElement = document.getElementById('calendar-title');
        const datesElement = document.getElementById('calendar-dates');
        
        // Заголовок месяца
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        titleElement.textContent = `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
        
        // Генерируем даты
        const startDate = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const endDate = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        
        const dates = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d));
        }
        
        // Рендерим даты
        const datesHtml = dates.map(date => {
            const dateStr = date.toISOString().split('T')[0];
            const hasConcerts = this.concerts.some(concert => concert.date === dateStr);
            const isSelected = this.selectedDate === dateStr;
            
            const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            const weekday = weekdays[date.getDay()];
            
            const classes = ['calendar-date'];
            if (hasConcerts) classes.push('has-concerts');
            if (isSelected) classes.push('selected');
            
            return `
                <div class="${classes.join(' ')}" data-date="${dateStr}">
                    <div class="date-day">${date.getDate()}</div>
                    <div class="date-weekday">${weekday}</div>
                </div>
            `;
        }).join('');
        
        datesElement.innerHTML = datesHtml;
        
        // Добавляем обработчики
        datesElement.querySelectorAll('.calendar-date').forEach(dateEl => {
            dateEl.addEventListener('click', () => {
                const clickedDate = dateEl.dataset.date;
                
                if (this.selectedDate === clickedDate) {
                    // Снимаем выбор
                    this.selectedDate = null;
                } else {
                    // Выбираем дату
                    this.selectedDate = clickedDate;
                }
                
                this.filterConcerts();
                this.renderCalendar();
            });
        });
    }
    
    updateTitle() {
        const titleElement = document.getElementById('concerts-title');
        const countElement = document.getElementById('concerts-count');
        
        let title = 'Все концерты';
        if (this.selectedDate) {
            const date = new Date(this.selectedDate);
            const options = { day: 'numeric', month: 'long' };
            title = `Концерты ${date.toLocaleDateString('ru-RU', options)}`;
        } else if (this.searchQuery) {
            title = `Поиск: "${this.searchQuery}"`;
        }
        
        titleElement.textContent = title;
        countElement.textContent = this.filteredConcerts.length;
    }
    
    showError(title, message) {
        const listElement = document.getElementById('concert-list');
        listElement.innerHTML = `
            <div class="error">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="error-title">${title}</div>
                <div class="error-message">${message}</div>
            </div>
        `;
    }
    
    showEmptyState(title, message) {
        const listElement = document.getElementById('concert-list');
        listElement.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-calendar-times"></i>
                </div>
                <div class="empty-title">${title}</div>
                <div class="empty-subtitle">${message}</div>
            </div>
        `;
    }
}

// Инициализация Yandex Maps
window.ymapsReady = null;
if (window.ymaps) {
    ymaps.ready(() => {
        if (window.ymapsReady) window.ymapsReady();
    });
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new ConcertApp();
});