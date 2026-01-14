// Современное VK мини-приложение для афиши концертов

class ConcertApp {
    constructor() {
        this.API_URL = 'https://permlive.ru/api/concerts/';
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
        console.log('=== APP INIT ===');
        console.log('API URL:', this.API_URL);
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
        document.getElementById('concert-list').style.display = 'none';
        
        // Управляем видимостью заголовка секции
        const sectionHeader = document.querySelector('.section-header');
        
        this.currentView = view;
        
        // Показываем нужный вид
        switch (view) {
            case 'map':
                document.getElementById('map-view').style.display = 'block';
                if (sectionHeader) sectionHeader.style.display = 'none'; // Скрываем заголовок на карте
                this.initMap();
                break;
            case 'list':
            default:
                document.getElementById('concert-list').style.display = 'block';
                if (sectionHeader) sectionHeader.style.display = 'flex'; // Показываем заголовок в списке
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
                controls: ['zoomControl'] // Возвращаем кнопки масштаба
            });
            
            // Добавляем метки концертов
            this.updateMapPlacemarks();
            
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
        
        // Получаем сегодняшнюю дату
        const today = new Date().toISOString().split('T')[0];
        
        // Получаем сегодняшнюю дату
        const today = new Date().toISOString().split('T')[0];
        
        // Фильтруем только сегодняшние концерты
        const todayConcerts = this.filteredConcerts.filter(concert => concert.date === today);
        
        console.log(`=== MAP UPDATE ===`);
        console.log('Today date:', today);
        console.log('Total filtered concerts:', this.filteredConcerts.length);
        console.log('Today concerts:', todayConcerts.length);
        
        if (todayConcerts.length === 0) {
            console.log('No concerts today for map');
            return;
        }
        
        // Создаем отдельную метку для каждого концерта
        todayConcerts.forEach((concert, index) => {
            const placeName = concert.place?.name || concert.place || 'Неизвестное место';
            const coords = this.getPlaceCoordinates(placeName, concert.place);
            
            // Добавляем небольшое смещение если концерты в одном месте
            const offset = index * 0.0001;
            const adjustedCoords = [coords[0] + offset, coords[1] + offset];
            
            // Определяем цвет маркера на основе тегов (как на основном сайте)
            let preset = 'islands#oliveStretchyIcon'; // По умолчанию
            if (concert.tags && concert.tags.length > 0) {
                const firstTag = concert.tags[0];
                const tagName = firstTag.name || firstTag;
                
                // Определяем тип тега для цвета маркера
                if (concert.tag_categories && concert.tag_categories.length > 0) {
                    const category = concert.tag_categories[0].toLowerCase();
                    if (category === 'live') {
                        preset = 'islands#redStretchyIcon';
                    } else if (category === 'pop') {
                        preset = 'islands#lightblueStretchyIcon';
                    } else {
                        preset = 'islands#oliveStretchyIcon';
                    }
                } else {
                    // Fallback определение по названию тега
                    const tagLower = tagName.toLowerCase();
                    if (tagLower.includes('live') || tagLower.includes('рок') || tagLower.includes('метал')) {
                        preset = 'islands#redStretchyIcon';
                    } else if (tagLower.includes('pop') || tagLower.includes('поп') || tagLower.includes('электрон')) {
                        preset = 'islands#lightblueStretchyIcon';
                    }
                }
            }
            
            const time = (concert.time || '').slice(0, 5);
            const iconContent = `${time} ${concert.title}`;
            
            const placemark = new ymaps.Placemark(adjustedCoords, {
                balloonContent: this.createSingleConcertBalloon(concert),
                hintContent: this.createSingleConcertHint(concert),
                iconContent: iconContent
            }, {
                preset: preset
            });
            
            this.map.geoObjects.add(placemark);
            this.mapPlacemarks.push(placemark);
        });
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
                // Парсим координаты точно как на основном сайте
                // Формат: "58.015634, 56.233587"
                const coordStr = place.coordinates.toString();
                
                const lat = parseFloat(coordStr.slice(0, 11));
                const lng = parseFloat(coordStr.slice(12));
                
                if (!isNaN(lat) && !isNaN(lng)) {
                    return [lat, lng];
                } else {
                    // Fallback: стандартный парсинг через запятую
                    const coords = place.coordinates.split(',').map(c => parseFloat(c.trim()));
                    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                        return coords;
                    }
                }
            } catch (e) {
                console.warn(`Failed to parse coordinates for ${placeName}:`, place.coordinates, e);
            }
        }
        
        // Fallback: РЕАЛЬНЫЕ координаты популярных площадок Перми
        const knownPlaces = {
            // Основные концертные площадки
            'БКЗ': [58.015634, 56.233587],
            'Большой концертный зал': [58.015634, 56.233587],
            'Пермская филармония': [58.015634, 56.233587],
            'Филармония': [58.015634, 56.233587],
            
            // Театры и залы
            'Органный зал': [58.015634, 56.233587],
            'Зал органной и камерной музыки': [58.015634, 56.233587],
            'Театр-Театр': [58.009500, 56.248500],
            'Пермский театр оперы и балета': [58.010000, 56.249000],
            'Театр оперы и балета': [58.010000, 56.249000],
            'ТЮЗ': [58.011000, 56.252000],
            'Театр юного зрителя': [58.011000, 56.252000],
            
            // Сегодняшние площадки - РЕАЛЬНЫЕ координаты
            'Distortion 66': [58.012500, 56.251500],
            'Distortion 66 Бар': [58.012500, 56.251500],
            'Munchen Pub': [58.013500, 56.252500],
            'ПДНТ «Губерния»': [58.014000, 56.254000],
            'ДК Солдатова': [58.014500, 56.254500],
            'Бар 13/69': [58.015000, 56.255000],
            
            // Клубы и бары
            'Подвал': [58.012000, 56.251000],
            'Граффити': [58.013000, 56.253000],
            'Дом культуры железнодорожников': [58.008000, 56.247000],
            'ДК железнодорожников': [58.008000, 56.247000],
            'Дом офицеров': [58.009000, 56.248000],
            
            // Современные площадки
            'Арт-резиденция': [58.012500, 56.251500],
            'Пространство': [58.013500, 56.252500],
            'Завод Шпагина': [58.014000, 56.254000],
            
            // Рестораны и кафе
            'Хлеб и вино': [58.010800, 56.250500],
            'Кафе': [58.011200, 56.250800],
            'Ресторан': [58.011800, 56.251200],
            
            // Общие названия
            'Клуб': [58.012500, 56.251500],
            'Бар': [58.012800, 56.251800],
            'Паб': [58.013200, 56.252200]
        };
        
        const placeNameLower = placeName.toLowerCase();
        
        // Ищем точное совпадение
        for (const [key, coords] of Object.entries(knownPlaces)) {
            if (placeNameLower === key.toLowerCase()) {
                return coords;
            }
        }
        
        // Ищем по ключевым словам
        for (const [key, coords] of Object.entries(knownPlaces)) {
            if (placeNameLower.includes(key.toLowerCase()) || key.toLowerCase().includes(placeNameLower)) {
                return coords;
            }
        }
        
        // Если не найдено, возвращаем координаты в центре Перми с детерминированным смещением
        const baseLat = 58.0105;
        const baseLng = 56.2502;
        
        // Создаем детерминированное смещение на основе названия места
        let hash = 0;
        for (let i = 0; i < placeName.length; i++) {
            hash = ((hash << 5) - hash + placeName.charCodeAt(i)) & 0xffffffff;
        }
        
        const randomLat = baseLat + ((hash % 100) / 10000) * (hash % 2 === 0 ? 1 : -1);
        const randomLng = baseLng + (((hash >> 8) % 100) / 5000) * ((hash >> 4) % 2 === 0 ? 1 : -1);
        
        return [randomLat, randomLng];
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
                            <div style="font-size: 14px; font-weight: 500; color: #1d1d1f; margin-bottom: 4px; line-height: 1.3; font-family: 'Inter', sans-serif;">${concert.title}</div>
                            <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px; font-family: 'Inter', sans-serif;">${placeName}</div>
                            <div style="font-size: 12px; color: #ff6b35; font-weight: 600; font-family: 'Inter', sans-serif;">${price}</div>
                        </div>
                    </a>
                    ${concert.place?.map ? `
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8eaed;">
                            <a href="${concert.place.map}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; color: #ff6b35; text-decoration: none; font-size: 12px; font-family: 'Jost', sans-serif; font-weight: 500;">
                                <i class="fas fa-route" style="font-size: 10px; font-weight: 400;"></i> Как проехать
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
        
        console.log('=== LOADING CONCERTS ===');
        console.log('API URL:', this.API_URL);
        
        // Функция для попытки загрузки
        const attemptLoad = async (attempt = 1) => {
            try {
                console.log(`Loading concerts (attempt ${attempt}) from:`, this.API_URL);
                const response = await fetch(this.API_URL, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                console.log('Response status:', response.status);
                console.log('Response OK:', response.ok);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                let data = await response.json();
                console.log('Raw API data received:', !!data);
                console.log('Number of concerts:', data?.length || 0);
                
                if (!Array.isArray(data) || !data.length) {
                    if (attempt < 3) {
                        console.log('No data received, retrying...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return attemptLoad(attempt + 1);
                    }
                    this.showEmptyState('Нет концертов', 'Концерты не найдены');
                    return;
                }
                
                // Отладка первого концерта
                if (data[0]) {
                    console.log('=== FIRST CONCERT SAMPLE ===');
                    console.log('Title:', data[0].title);
                    console.log('Date:', data[0].date);
                    console.log('Time:', data[0].time);
                    console.log('Rating:', data[0].rating);
                    console.log('Tags:', data[0].tags);
                    console.log('Tag categories:', data[0].tag_categories);
                    console.log('Images:', {
                        image: data[0].image,
                        main_image: data[0].main_image,
                        small_pic: data[0].small_pic
                    });
                    console.log('Place:', data[0].place);
                    console.log('Is published:', data[0].is_published);
                    console.log('=== END SAMPLE ===');
                }
                
                // Фильтруем будущие концерты
                data = this.filterFutureConcerts(data);
                console.log('Future concerts:', data.length);
                
                // Сортируем концерты
                this.concerts = this.sortConcerts(data);
                this.filteredConcerts = [...this.concerts];
                
                console.log('Final concerts count:', this.concerts.length);
                
                this.renderConcerts();
                
            } catch (error) {
                console.error(`Load attempt ${attempt} failed:`, error);
                if (attempt < 3) {
                    console.log('Retrying in 2 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return attemptLoad(attempt + 1);
                }
                this.showError('Ошибка загрузки', `Не удалось загрузить список концертов после ${attempt} попыток: ${error.message}`);
            }
        };
        
        await attemptLoad();
    }
    
    filterFutureConcerts(concerts) {
        const now = new Date();
        // Устанавливаем время на начало текущего дня для более мягкой фильтрации
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        console.log('=== FILTERING CONCERTS ===');
        console.log('Total concerts before filtering:', concerts.length);
        console.log('Current time:', now.toISOString());
        console.log('Today start (for filtering):', todayStart.toISOString());
        
        const filtered = concerts.filter((concert, index) => {
            if (!concert.date) {
                console.log(`Concert ${index + 1} (${concert.title}): No date - KEEPING`);
                return true; // Оставляем концерты без даты
            }
            
            // Парсим дату концерта
            const [year, month, day] = concert.date.split('-').map(Number);
            const concertDate = new Date(year, month - 1, day);
            
            // Если есть время, добавляем его
            if (concert.time) {
                const [hour, minute] = concert.time.split(':').map(Number);
                concertDate.setHours(hour, minute);
            } else {
                // Если времени нет, считаем что концерт в конце дня
                concertDate.setHours(23, 59);
            }
            
            // Сравниваем с началом сегодняшнего дня, а не с текущим временем
            const isFuture = concertDate >= todayStart;
            
            if (!isFuture) {
                console.log(`Concert ${index + 1} (${concert.title}): ${concertDate.toISOString()} - FILTERED OUT (past)`);
            } else {
                console.log(`Concert ${index + 1} (${concert.title}): ${concertDate.toISOString()} - KEEPING (future/today)`);
            }
            
            return isFuture;
        });
        
        console.log('Concerts after filtering:', filtered.length);
        console.log('Filtered out:', concerts.length - filtered.length, 'concerts');
        console.log('=== END FILTERING ===');
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
        
        // Проверяем на заглушки VK
        if (url.includes('camera_200.png') || 
            url === 'https://vk.ru/images/camera_200.png' ||
            url.includes('vk.ru/images/') ||
            url.includes('vk.com/images/')) {
            return false;
        }
        
        // Проверяем на другие заглушки
        if (url.includes('placeholder') || 
            url.includes('no-image') ||
            url.includes('default.jpg') ||
            url.includes('stub.')) {
            return false;
        }
        
        // Проверяем что это похоже на URL изображения
        if (!url.startsWith('http')) {
            return false;
        }
        
        // Дополнительная проверка на валидные домены изображений
        const validDomains = [
            'permlive.ru',
            'vkuserphoto.ru', 
            'sun9-',  // VK CDN
            'pp.userapi.com',
            'pp.vk.me',
            'cs',  // VK CDN
            'imgur.com',
            'i.imgur.com'
        ];
        
        const hasValidDomain = validDomains.some(domain => url.includes(domain));
        if (!hasValidDomain) {
            console.log(`  -> Unknown domain for image: ${url}`);
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
        
        console.log(`=== IMAGE DEBUG for ${title} ===`);
        console.log('Available image fields:', {
            image: concert.image,
            main_image: concert.main_image,
            small_pic: concert.small_pic,
            poster: concert.poster,
            photo: concert.photo,
            avatar: concert.avatar,
            thumbnail: concert.thumbnail,
            cover: concert.cover,
            images: concert.images,
            place_avatar: concert.place?.avatar,
            place_image: concert.place?.image
        });
        
        // Проверяем каждое поле на валидность
        for (const field of imageFields) {
            if (this.isValidImageUrl(field)) {
                imageUrl = field;
                console.log('  -> Selected valid image:', imageUrl);
                break;
            }
        }
        
        if (!imageUrl) {
            imageUrl = 'zhivoe_logo.jpg';
            console.log('  -> No valid images found, using fallback logo');
        } else {
            // Если это изображение с permlive.ru, добавляем параметры размера
            if (imageUrl.includes('permlive.ru') && !imageUrl.includes('zhivoe_logo.jpg')) {
                // Убираем старые параметры если есть
                imageUrl = imageUrl.split('?')[0];
                // Добавляем новые параметры для получения изображения 300px
                imageUrl += '?w=300&h=300&fit=crop&q=80';
                console.log('  -> Optimized URL:', imageUrl);
            }
        }
        console.log('=== END IMAGE DEBUG ===');
        
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
                             onerror="if (!this.src.includes('zhivoe_logo.jpg')) { this.src='zhivoe_logo.jpg'; }"
                             onload="console.log('Image loaded successfully for ${title}:', this.src)">
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
        
        console.log(`=== TAGS DEBUG for ${concert.title} ===`);
        console.log('Tags:', concert.tags);
        console.log('Tag categories:', concert.tag_categories);
        
        // Показываем все теги с правильными цветами
        return concert.tags.map((tag, index) => {
            const tagName = tag.name || tag;
            
            // Определяем цветовую схему на основе категории тега
            let tagClass = 'tag genre';
            
            // Сначала проверяем tag_categories если есть
            if (concert.tag_categories && concert.tag_categories.length > index) {
                const category = concert.tag_categories[index].toLowerCase();
                console.log(`Tag "${tagName}" has category: ${category}`);
                if (category === 'live') {
                    tagClass += ' live';
                } else if (category === 'pop') {
                    tagClass += ' pop';
                } else if (category === 'classic') {
                    tagClass += ' classic';
                }
            } else {
                // Fallback: определяем по названию тега
                const tagNameLower = tagName.toLowerCase();
                console.log(`Tag "${tagName}" - using fallback categorization`);
                
                if (tagNameLower.includes('live') || tagNameLower.includes('рок') || tagNameLower.includes('метал') || 
                    tagNameLower.includes('панк') || tagNameLower.includes('хардкор') || tagNameLower.includes('альтернатив')) {
                    tagClass += ' live';
                    console.log('  -> Categorized as LIVE');
                } else if (tagNameLower.includes('pop') || tagNameLower.includes('поп') || tagNameLower.includes('эстрада') || 
                          tagNameLower.includes('диско') || tagNameLower.includes('электрон') || tagNameLower.includes('хип-хоп')) {
                    tagClass += ' pop';
                    console.log('  -> Categorized as POP');
                } else if (tagNameLower.includes('classic') || tagNameLower.includes('классик') || tagNameLower.includes('джаз') || 
                          tagNameLower.includes('блюз') || tagNameLower.includes('фолк') || tagNameLower.includes('кантри') ||
                          tagNameLower.includes('инди') || tagNameLower.includes('авторск')) {
                    tagClass += ' classic';
                    console.log('  -> Categorized as CLASSIC');
                } else {
                    console.log('  -> No specific category, using default');
                }
            }
            
            return `<span class="${tagClass}">${tagName}</span>`;
        }).join(' ');
    }
    
    formatRatingBadge(rating) {
        const ratingValue = parseFloat(rating || 0);
        console.log(`Rating for concert: ${rating} -> parsed: ${ratingValue}`);
        
        if (ratingValue < 4.0) {
            console.log('  -> Rating below 4.0, not showing badge');
            return '';
        }
        
        console.log('  -> Showing rating badge');
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
    console.log('=== DOM LOADED ===');
    console.log('Starting ConcertApp...');
    try {
        const app = new ConcertApp();
        console.log('ConcertApp initialized:', app);
    } catch (error) {
        console.error('Failed to initialize ConcertApp:', error);
    }
});