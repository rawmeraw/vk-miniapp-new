// Современное VK мини-приложение для афиши концертов

class ConcertApp {
    constructor() {
        this.API_URL = 'https://permlive.ru/api/concerts/';
        this.BENEFIT_API_URL = 'https://permlive.ru/api/benefit/';
        this.concerts = [];
        this.benefitConcerts = [];
        this.filteredConcerts = [];
        this.selectedDate = null;
        this.currentMonth = new Date();
        this.searchQuery = '';
        this.currentView = 'list';
        this.map = null;
        this.clusterer = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadConcerts();
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
    }
    
    switchView(view) {
        // Обновляем кнопки
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Скрываем все виды
        document.getElementById('map-view').style.display = 'none';
        document.getElementById('concert-list').parentElement.style.display = 'none';
        document.getElementById('benefits-section').style.display = 'none';
        
        this.currentView = view;
        
        // Показываем нужный вид
        switch (view) {
            case 'map':
                document.getElementById('map-view').style.display = 'block';
                this.initMap();
                break;
            case 'benefit':
                document.getElementById('benefits-section').style.display = 'block';
                if (this.benefitConcerts.length === 0) {
                    this.loadBenefitConcerts();
                } else {
                    this.renderBenefitConcerts();
                }
                break;
            case 'list':
            default:
                document.getElementById('concert-list').parentElement.style.display = 'block';
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
            
            // Создаем кластеризатор с цветными круговыми диаграммами
            this.clusterer = new ymaps.Clusterer({
                preset: 'islands#redClusterIcons',
                clusterIconLayout: 'default#pieChart',
                clusterIconPieChartRadius: 15,
                clusterIconPieChartCoreRadius: 10,
                zoomMargin: 50
            });
            
            // Добавляем кластеризатор на карту
            this.map.geoObjects.add(this.clusterer);
            
            // Добавляем метки концертов
            this.updateMapPlacemarks();
            
        } catch (error) {
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
        if (!this.map || !this.clusterer) return;
        
        // Очищаем кластеризатор
        this.clusterer.removeAll();
        
        // Получаем сегодняшнюю дату по местному времени (не UTC!)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
        
        // Фильтруем только сегодняшние концерты
        const todayConcerts = this.filteredConcerts.filter(concert => concert.date === today);
        
        if (todayConcerts.length === 0) {
            return;
        }
        
        // Создаем маркеры и добавляем в кластеризатор
        todayConcerts.forEach((concert) => {
            const placeName = concert.place?.name || concert.place || 'Неизвестное место';
            const coords = this.getPlaceCoordinates(placeName, concert.place);
            
            // Определяем цвет маркера на основе тегов
            const preset = this.getPlacemarkPreset(concert);
            
            const time = (concert.time || '').slice(0, 5);
            const iconContent = `${time} ${concert.title}`;
            
            const placemark = new ymaps.Placemark(coords, {
                balloonContent: this.createSingleConcertBalloon(concert),
                hintContent: this.createSingleConcertHint(concert),
                iconContent: iconContent
            }, {
                preset: preset
            });
            
            this.clusterer.add(placemark);
        });
        
        // Автоматическое масштабирование карты по всем меткам
        if (this.clusterer.getGeoObjects().length > 0) {
            const bounds = this.clusterer.getBounds();
            if (bounds) {
                this.map.setBounds(bounds, {
                    checkZoomRange: true,
                    zoomMargin: 50
                });
            }
        }
    }
    
    createHintContent(concerts) {
        if (concerts.length === 1) {
            const concert = concerts[0];
            const time = (concert.time || '').slice(0, 5);
            return `${time} - ${concert.title}`;
        } else {
            return `${concerts.length} концерт${concerts.length === 1 ? '' : concerts.length < 5 ? 'а' : 'ов'} сегодня`;
        }
    }
    
    getPlaceCoordinates(placeName, place) {
        // Если у места есть координаты из API, используем их
        if (place && place.coordinates) {
            try {
                const coordStr = place.coordinates.toString();
                console.log('Original coordinates:', coordStr, 'for place:', placeName);
                
                // Парсим с точностью до 6 знаков после запятой
                const coords = place.coordinates.split(',').map(c => {
                    // Удаляем все пробелы и парсим как число
                    const num = parseFloat(c.trim().replace(/\s+/g, ''));
                    // Форматируем до 6 знаков после запятой, добавляя нули при необходимости
                    const formatted = parseFloat(num.toFixed(6));
                    console.log('Parsed coordinate:', c, '->', formatted);
                    return formatted;
                });
                
                console.log('Final coordinates array:', coords);
                
                if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                    return coords;
                }
            } catch (e) {
                console.error('Error parsing coordinates:', e);
                // Ошибка парсинга координат
            }
        }
        
        // Если нет координат в API, возвращаем центр Перми
        console.log('No coordinates found for', placeName, 'using Perm center');
        return [58.0105, 56.2502];
    }
    
    getPlacemarkPreset(concert) {
        // Определяем цвет маркера на основе категории тега
        if (concert.tag_categories && concert.tag_categories.length > 0) {
            const category = concert.tag_categories[0].toLowerCase();
            if (category === 'live') return 'islands#redStretchyIcon';
            if (category === 'pop') return 'islands#lightblueStretchyIcon';
            return 'islands#oliveStretchyIcon';
        }
        
        // Fallback: определение по названию тега
        if (concert.tags && concert.tags.length > 0) {
            const firstTag = concert.tags[0];
            const tagName = (firstTag.name || firstTag).toLowerCase();
            
            if (tagName.includes('live') || tagName.includes('рок') || tagName.includes('метал')) {
                return 'islands#redStretchyIcon';
            }
            if (tagName.includes('pop') || tagName.includes('поп') || tagName.includes('электрон')) {
                return 'islands#lightblueStretchyIcon';
            }
        }
        
        return 'islands#oliveStretchyIcon';
    }
    
    createSingleConcertHint(concert) {
        const time = (concert.time || '').slice(0, 5);
        return `${time} - ${concert.title}`;
    }
    
    createSingleConcertBalloon(concert) {
        // Используем ту же логику выбора изображения
        const imageFields = [
            concert.image,
            concert.main_image,
            concert.small_pic, 
            concert.poster,
            concert.photo,
            concert.avatar,
            concert.thumbnail,
            concert.cover,
            ...(Array.isArray(concert.images) ? concert.images.map(img => img.url || img) : []),
            concert.place?.avatar,
            concert.place?.image,
            concert.place?.photo
        ];
        
        let imageUrl = null;
        for (const field of imageFields) {
            if (this.isValidImageUrl(field)) {
                imageUrl = field;
                break;
            }
        }
        
        if (!imageUrl) {
            imageUrl = 'zhivoe_logo.jpg';
        }
        
        const link = concert.slug ? `https://permlive.ru/event/${concert.slug}` : '#';
        const time = (concert.time || '').slice(0, 5);
        const price = concert.price > 0 ? `${concert.price}₽` : 'Бесплатно';
        const placeName = concert.place?.name || concert.place || 'Неизвестное место';
        
        return `
            <div style="max-width: 280px; font-family: 'Jost', sans-serif; position: relative;">
                <div style="background: white; padding: 12px;">
                    <a href="${link}" target="_blank" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 12px;">
                        <img src="${imageUrl}" alt="${concert.title}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #f1f3f4; flex-shrink: 0;" 
                             onerror="this.src='zhivoe_logo.jpg'">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 14px; font-weight: 500; color: #1d1d1f; margin-bottom: 4px; line-height: 1.3; font-family: 'Jost', sans-serif;">${concert.title}</div>
                            <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px; font-family: 'Jost', sans-serif;">${placeName}</div>
                            <div style="font-size: 12px; color: #ff6b35; font-weight: 600; font-family: 'Jost', sans-serif;">${price}</div>
                        </div>
                    </a>
                    ${concert.place?.map ? `
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8eaed;">
                            <a href="${concert.place.map}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; color: #ff6b35; text-decoration: none; font-size: 12px; font-family: 'Jost', sans-serif; font-weight: 500;">
                                Построить маршрут
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    createBalloonContent(placeName, concerts, place) {
        const concertsHtml = concerts.slice(0, 3).map(concert => {
            // Используем ту же логику выбора изображения
            const imageFields = [
                concert.main_image,
                concert.small_pic, 
                concert.image,
                concert.poster,
                concert.photo
            ];
            
            let imageUrl = null;
            for (const field of imageFields) {
                if (this.isValidImageUrl(field)) {
                    imageUrl = field;
                    break;
                }
            }
            
            if (!imageUrl) {
                imageUrl = 'zhivoe_logo.jpg';
            }
            
            const link = concert.slug ? `https://permlive.ru/event/${concert.slug}` : '#';
            const time = (concert.time || '').slice(0, 5);
            const price = concert.price > 0 ? `${concert.price}₽` : 'Бесплатно';
            
            return `
                <a href="${link}" class="map-balloon-concert" target="_blank" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 8px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 6px; transition: background 0.2s ease;">
                    <img src="${imageUrl}" alt="${concert.title}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #f1f3f4; flex-shrink: 0;" 
                         onerror="this.src='zhivoe_logo.jpg'">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 13px; font-weight: 500; color: #1d1d1f; margin-bottom: 2px; line-height: 1.2; font-family: 'Jost', sans-serif; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${concert.title}</div>
                        <div style="font-size: 11px; color: #5f6368; font-family: 'Jost Light', sans-serif;">${time ? `${time}` : 'Время уточняется'} • ${price}</div>
                    </div>
                </a>
            `;
        }).join('');
        
        const moreText = concerts.length > 3 ? `<div style="text-align: center; padding: 8px; color: #5f6368; font-size: 12px; font-family: 'Jost Light', sans-serif;">и ещё ${concerts.length - 3} концерт${concerts.length - 3 === 1 ? '' : concerts.length - 3 < 5 ? 'а' : 'ов'}</div>` : '';
        
        // Информация о месте
        const placeInfo = place ? `
            <div style="padding: 8px 12px; border-top: 1px solid #e8eaed; background: #f8f9fa;">
                ${place.map ? `
                    <a href="${place.map}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; color: #ff6b35; text-decoration: none; font-size: 12px; font-family: 'Jost', sans-serif; font-weight: 500;">
                        <span style="font-size: 10px;">🗺️</span> Как проехать
                    </a>
                ` : ''}
                <div style="font-size: 11px; color: #5f6368; margin-top: 4px; font-family: 'Jost Light', sans-serif;">
                    📍 ${placeName}
                </div>
            </div>
        ` : '';
        
        return `
            <div style="max-width: 280px; font-family: 'Jost', sans-serif;">
                <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 12px; text-align: center;">
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px; line-height: 1.3; font-family: 'Jost', sans-serif;">${placeName}</div>
                    <div style="font-size: 12px; opacity: 0.9; font-family: 'Jost Light', sans-serif;">Сегодня: ${concerts.length} концерт${concerts.length === 1 ? '' : concerts.length < 5 ? 'а' : 'ов'}</div>
                </div>
                <div style="background: white; padding: 12px;">
                    <div>
                        ${concertsHtml}
                        ${moreText}
                    </div>
                </div>
                ${placeInfo}
            </div>
        `;
    }
    
    async loadConcerts() {
        const listElement = document.getElementById('concert-list');
        
        // Функция для попытки загрузки
        const attemptLoad = async (attempt = 1) => {
            try {
                const response = await fetch(this.API_URL, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                let data = await response.json();
                
                if (!Array.isArray(data) || !data.length) {
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return attemptLoad(attempt + 1);
                    }
                    this.showEmptyState('Нет концертов', 'Концерты не найдены');
                    return;
                }
                
                // Фильтруем будущие концерты
                data = this.filterFutureConcerts(data);
                
                // Сортируем концерты
                this.concerts = this.sortConcerts(data);
                this.filteredConcerts = [...this.concerts];
                
                this.renderConcerts();
                
            } catch (error) {
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return attemptLoad(attempt + 1);
                }
                this.showError('Ошибка загрузки', `Не удалось загрузить список концертов после ${attempt} попыток: ${error.message}`);
            }
        };
        
        await attemptLoad();
    }
    
    async loadBenefitConcerts() {
        const listElement = document.getElementById('benefits-list');
        
        const attemptLoad = async (attempt = 1) => {
            try {
                const response = await fetch(this.BENEFIT_API_URL, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                let data = await response.json();
                
                if (!Array.isArray(data) || !data.length) {
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return attemptLoad(attempt + 1);
                    }
                    this.showEmptyBenefitsState();
                    return;
                }
                
                // Фильтруем будущие концерты
                data = this.filterFutureConcerts(data);
                
                // Сортируем по дате добавления (новые первые)
                this.benefitConcerts = data.sort((a, b) => {
                    const dateA = new Date(a.date_added || 0);
                    const dateB = new Date(b.date_added || 0);
                    return dateB - dateA;
                });
                
                this.renderBenefitConcerts();
                
            } catch (error) {
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return attemptLoad(attempt + 1);
                }
                this.showErrorBenefits(`Не удалось загрузить выгодные предложения после ${attempt} попыток: ${error.message}`);
            }
        };
        
        await attemptLoad();
    }
    
    renderBenefitConcerts() {
        const listElement = document.getElementById('benefits-list');
        const countElement = document.getElementById('benefits-count');
        
        if (!this.benefitConcerts.length) {
            this.showEmptyBenefitsState();
            return;
        }
        
        listElement.innerHTML = this.benefitConcerts.map(concert => this.createConcertCard(concert)).join('');
        countElement.textContent = `${this.benefitConcerts.length} ${this.getConcertWord(this.benefitConcerts.length)}`;
    }
    
    showEmptyBenefitsState() {
        const listElement = document.getElementById('benefits-list');
        const countElement = document.getElementById('benefits-count');
        
        listElement.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <div class="empty-title">Нет выгодных предложений</div>
                <div class="empty-description">Сейчас нет концертов с реферальными ссылками</div>
            </div>
        `;
        countElement.textContent = '0 концертов';
    }
    
    showErrorBenefits(message) {
        const listElement = document.getElementById('benefits-list');
        const countElement = document.getElementById('benefits-count');
        
        listElement.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <div class="error-title">Ошибка загрузки</div>
                <div class="error-description">${message}</div>
            </div>
        `;
        countElement.textContent = 'Ошибка';
    }
    
    filterFutureConcerts(concerts) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const filtered = concerts.filter((concert) => {
            if (!concert.date) {
                return true;
            }
            
            const [year, month, day] = concert.date.split('-').map(Number);
            const concertDate = new Date(year, month - 1, day);
            
            if (concert.time) {
                const [hour, minute] = concert.time.split(':').map(Number);
                concertDate.setHours(hour, minute);
            } else {
                concertDate.setHours(23, 59);
            }
            
            return concertDate >= todayStart;
        });
        
        return filtered;
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
    
    isValidImageUrl(url) {
        if (!url || url === '' || url === null || url === undefined) {
            return false;
        }
        
        if (url.includes('camera_200.png') || 
            url === 'https://vk.ru/images/camera_200.png' ||
            url.includes('vk.ru/images/') ||
            url.includes('vk.com/images/')) {
            return false;
        }
        
        if (url.includes('placeholder') || 
            url.includes('no-image') ||
            url.includes('default.jpg') ||
            url.includes('stub.')) {
            return false;
        }
        
        if (!url.startsWith('http')) {
            return false;
        }
        
        return true;
    }
    
    formatConcert(concert) {
        const title = concert.title || 'Без названия';
        const date = concert.date || '';
        const time = (concert.time || '').slice(0, 5);
        const place = (concert.place?.name || concert.place || '');
        
        // Изображение - пробуем разные поля в порядке приоритета
        const imageFields = [
            concert.image,           // Основное поле изображения в API
            concert.main_image,      // На случай если добавят позже
            concert.small_pic,       // Уменьшенная версия
            concert.poster,          // Постер
            concert.photo,           // Фото
            concert.avatar,          // Аватар
            concert.thumbnail,       // Миниатюра
            concert.cover,           // Обложка
            // Если есть массив изображений, берем первое
            ...(Array.isArray(concert.images) ? concert.images.map(img => img.url || img) : []),
            // Изображение места как fallback
            concert.place?.avatar,
            concert.place?.image,
            concert.place?.photo
        ];
        
        let imageUrl = null;
        
        for (const field of imageFields) {
            if (this.isValidImageUrl(field)) {
                imageUrl = field;
                break;
            }
        }
        
        if (!imageUrl) {
            imageUrl = 'zhivoe_logo.jpg';
        } else {
            if (imageUrl.includes('permlive.ru') && !imageUrl.includes('zhivoe_logo.jpg')) {
                imageUrl = imageUrl.split('?')[0];
                imageUrl += '?w=300&h=300&fit=crop&q=80';
            }
        }
        
        // Дата и время
        const dateLabel = this.formatDate(date, time);
        
        // Кнопка покупки билетов
        const ticketButton = this.formatTicketButton(concert);
        
        // Теги с цветовой схемой
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
            <div class="${cardClasses.join(' ')}">
                <a href="${link}" target="_blank" style="text-decoration: none; color: inherit;">
                    <div class="concert-header">
                        <img src="${imageUrl}" alt="${title}" class="concert-image" 
                             onerror="if (!this.src.includes('zhivoe_logo.jpg')) { this.src='zhivoe_logo.jpg'; }">
                        <div class="concert-info">
                            <div class="concert-title-container">
                                ${this.formatRatingBadge(concert.rating)}
                                <div class="concert-title">${title}</div>
                            </div>
                            <div class="concert-meta">
                                <div class="concert-datetime">
                                    ${dateLabel}
                                </div>
                                ${place ? `
                                    <div class="concert-venue">
                                        ${place}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="concert-footer">
                        <div class="concert-tags">
                            ${tags}
                        </div>
                    </div>
                </a>
                ${ticketButton}
            </div>
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
    
    formatTicketButton(concert) {
        if (concert.tickets && typeof concert.tickets === 'string' && concert.tickets.trim()) {
            const price = concert.price;
            let buttonText = 'Купить билет';
            
            if (price && price > 0) {
                buttonText = `Купить билет от ${price}₽`;
            } else if (price === 0) {
                buttonText = 'Бесплатный вход';
            }
            
            return `
                <a href="${concert.tickets}" class="buy-ticket-btn" target="_blank" onclick="event.stopPropagation();">
                    ${buttonText}
                </a>
            `;
        }
        return '';
    }
    
    formatTags(concert) {
        if (!Array.isArray(concert.tags) || !concert.tags.length) return '';
        
        return concert.tags.map((tag, index) => {
            const tagName = tag.name || tag;
            let tagClass = 'tag genre';
            
            if (concert.tag_categories && concert.tag_categories.length > index) {
                const category = concert.tag_categories[index].toLowerCase();
                if (category === 'live') {
                    tagClass += ' live';
                } else if (category === 'pop') {
                    tagClass += ' pop';
                } else if (category === 'classic') {
                    tagClass += ' classic';
                }
            } else {
                const tagNameLower = tagName.toLowerCase();
                
                if (tagNameLower.includes('live') || tagNameLower.includes('рок') || tagNameLower.includes('метал') || 
                    tagNameLower.includes('панк') || tagNameLower.includes('хардкор') || tagNameLower.includes('альтернатив')) {
                    tagClass += ' live';
                } else if (tagNameLower.includes('pop') || tagNameLower.includes('поп') || tagNameLower.includes('эстрада') || 
                          tagNameLower.includes('диско') || tagNameLower.includes('электрон') || tagNameLower.includes('хип-хоп')) {
                    tagClass += ' pop';
                } else if (tagNameLower.includes('classic') || tagNameLower.includes('классик') || tagNameLower.includes('джаз') || 
                          tagNameLower.includes('блюз') || tagNameLower.includes('фолк') || tagNameLower.includes('кантри') ||
                          tagNameLower.includes('инди') || tagNameLower.includes('авторск')) {
                    tagClass += ' classic';
                }
            }
            
            return `<span class="${tagClass}">${tagName}</span>`;
        }).join(' ');
    }
    
    formatRatingBadge(rating) {
        const ratingValue = parseFloat(rating || 0);
        
        if (ratingValue < 4.0) {
            return '';
        }
        
        return `
            <div class="rating-badge-inline">
                <i class="fas fa-star"></i>
                ${ratingValue.toFixed(1)}
            </div>
        `;
    }
    
    formatRating(rating) {
        // Эта функция больше не используется, так как рейтинг теперь показывается inline
        return '';
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
        
        // Генерируем даты текущего месяца
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const today = new Date();
        
        // Первый и последний день месяца
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const dates = [];
        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            // Показываем только будущие даты (включая сегодня)
            if (d >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                dates.push(new Date(d));
            }
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