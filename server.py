from flask import Flask, jsonify, request
import requests

app = Flask(__name__)

API_KEY = 'ce46b76bd9d742278f313231250611'

@app.route('/api/weather/<city>')
def get_weather(city):
    """API endpoint để JavaScript gọi và lấy dữ liệu thời tiết"""
    try:
        lang = request.args.get('lang', 'vi')
        url = f'https://api.weatherapi.com/v1/forecast.json?key={API_KEY}&q={city}&days=3&lang={lang}'
        response = requests.get(url, timeout=8)
        response.raise_for_status()

        data = response.json()
        current = data['current']
        forecast = data['forecast']['forecastday']
        today_day = forecast[0]['day']
        # --- Build hourly list: lấy các giờ từ "bây giờ" trở đi, tối đa 12 giờ ---
        now_epoch = data['location'].get('localtime_epoch', 0)
        all_hours = []
        for fd in forecast[:2]:  # dùng hôm nay + ngày mai để đủ giờ tiếp nối
            for h in fd.get('hour', []):
                all_hours.append(h)
        future_hours = [h for h in all_hours if h.get('time_epoch', 0) >= now_epoch]
        hourly_slice = future_hours[:12] if future_hours else all_hours[:12]

        hourly = []
        for h in hourly_slice:
            hourly.append({
                'time': h.get('time'),
                'temp_c': h.get('temp_c'),
                'feelslike_c': h.get('feelslike_c', h.get('temp_c')),
                'chance_of_rain': h.get('chance_of_rain', 0),
                'uv': h.get('uv', 0),
                'wind_kph': h.get('wind_kph', 0),
                'wind_degree': h.get('wind_degree', 0),
                'wind_dir': h.get('wind_dir', ''),
                'icon': h.get('condition', {}).get('icon', ''),
                'condition_text': h.get('condition', {}).get('text', ''),
                'precip_mm': h.get('precip_mm', 0),
                'humidity': h.get('humidity', 0),
                'cloud': h.get('cloud', 0)
            })

        # --- Build daily list: mở rộng từ 3 ngày thành 10 ngày ---
        from datetime import datetime, timedelta
        import random
        
        daily = []
        daily_hours = []
        
        # Lấy 3 ngày thực từ API
        for fd in forecast:
            day = fd.get('day', {})
            astro = fd.get('astro', {})
            daily.append({
                'date': fd.get('date'),
                'maxtemp_c': day.get('maxtemp_c'),
                'mintemp_c': day.get('mintemp_c'),
                'avgtemp_c': day.get('avgtemp_c'),
                'avghumidity': day.get('avghumidity'),
                'avgvis_km': day.get('avgvis_km', 0),
                'uv': day.get('uv'),
                'totalprecip_mm': day.get('totalprecip_mm'),
                'daily_chance_of_rain': day.get('daily_chance_of_rain', 0),
                'icon': day.get('condition', {}).get('icon', ''),
                'condition_text': day.get('condition', {}).get('text', ''),
                'sunrise': astro.get('sunrise'),
                'sunset': astro.get('sunset'),
                'moonrise': astro.get('moonrise'),
                'moonset': astro.get('moonset'),
            })
            hours = []
            for h in fd.get('hour', []):
                hours.append({
                    'time': h.get('time'),
                    'temp_c': h.get('temp_c'),
                    'feelslike_c': h.get('feelslike_c', h.get('temp_c')),
                    'chance_of_rain': h.get('chance_of_rain', 0),
                    'uv': h.get('uv', 0),
                    'wind_kph': h.get('wind_kph', 0),
                    'wind_degree': h.get('wind_degree', 0),
                    'wind_dir': h.get('wind_dir', ''),
                    'icon': h.get('condition', {}).get('icon', ''),
                    'condition_text': h.get('condition', {}).get('text', ''),
                    'precip_mm': h.get('precip_mm', 0),
                    'humidity': h.get('humidity', 0),
                    'cloud': h.get('cloud', 0)
                })
            daily_hours.append({'date': fd.get('date'), 'hours': hours})
        
        # Tạo thêm 7 ngày giả để có đủ 10 ngày (cho demo)
        if len(daily) > 0:
            last_date = datetime.strptime(daily[-1]['date'], '%Y-%m-%d')
            weather_icons = [
                '//cdn.weatherapi.com/weather/64x64/day/113.png',  # Sunny
                '//cdn.weatherapi.com/weather/64x64/day/116.png',  # Partly cloudy
                '//cdn.weatherapi.com/weather/64x64/day/119.png',  # Cloudy
                '//cdn.weatherapi.com/weather/64x64/day/176.png',  # Patchy rain
                '//cdn.weatherapi.com/weather/64x64/day/266.png',  # Light drizzle
            ]
            weather_texts = ['Nắng', 'Có mây', 'Nhiều mây', 'Có mưa rải rác', 'Mưa phùn']
            
            for i in range(7):
                next_date = last_date + timedelta(days=i+1)
                date_str = next_date.strftime('%Y-%m-%d')
                
                # Tạo dữ liệu ngẫu nhiên dựa trên pattern của 3 ngày đầu
                base_temp = daily[i % 3]['maxtemp_c']
                temp_variation = random.uniform(-3, 3)
                weather_idx = random.randint(0, len(weather_icons)-1)
                
                daily.append({
                    'date': date_str,
                    'maxtemp_c': round(base_temp + temp_variation, 1),
                    'mintemp_c': round(base_temp + temp_variation - random.uniform(5, 8), 1),
                    'avgtemp_c': round(base_temp + temp_variation - 3, 1),
                    'avghumidity': random.randint(65, 85),
                    'uv': round(random.uniform(1, 5), 1),
                    'totalprecip_mm': round(random.uniform(0, 10), 1),
                    'daily_chance_of_rain': random.randint(20, 80),
                    'icon': weather_icons[weather_idx],
                    'condition_text': weather_texts[weather_idx],
                    'sunrise': '06:00 AM',
                    'sunset': '05:30 PM',
                    'moonrise': '08:00 PM',
                    'moonset': '10:00 AM',
                })
                
                # Tạo hourly data giả cho ngày này
                daily_hours.append({'date': date_str, 'hours': daily_hours[i % 3]['hours']})

        print(f"Total daily forecast days: {len(daily)}")  # Debug log

        weather_data = {
            'location': data['location']['name'],
            'temperature': current['temp_c'],
            'condition': current['condition']['text'],
            'feels_like': current['feelslike_c'],
            'icon': current['condition']['icon'],
            'precip_mm': current.get('precip_mm', 0),
            'temp_max': today_day['maxtemp_c'],
            'temp_min': today_day['mintemp_c'],
            'chance_of_rain': today_day.get('daily_chance_of_rain', 0),
            'chance_of_thunder': 0,  # WeatherAPI không có trực tiếp
            'temp_change_24h': current['temp_c'] - today_day['avgtemp_c'],
            'windchill_c': current.get('windchill_c', current['temp_c']),
            'heat_index_c': current.get('heat_index_c', current['temp_c']),
            'visibility_km': current['vis_km'],
            'cloud_cover': current['cloud'],
            'wind_kph': current['wind_kph'],
            'wind_degree': current['wind_degree'],
            'gust_kph': current['gust_kph'],
            'relative_humidity': current['humidity'],
            'wind_dir': current.get('wind_dir', current.get('wind_direction', '')),
            'uv_index': current['uv'],
            'air_pressure_hpa': current['pressure_mb'],
            'hourly': hourly,
            'daily': daily,
            'daily_hours': daily_hours,
        }

        return jsonify(weather_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    """Trả về file HTML với CSS và JS được serve đúng"""
    with open('main.html', 'r', encoding='utf-8') as f:
        return f.read()

@app.route('/main.css')
def serve_css():
    """Serve CSS file"""
    with open('main.css', 'r', encoding='utf-8') as f:
        from flask import Response
        return Response(f.read(), mimetype='text/css')

@app.route('/main.js')
def serve_js():
    """Serve JavaScript file"""
    with open('main.js', 'r', encoding='utf-8') as f:
        from flask import Response
        return Response(f.read(), mimetype='application/javascript')

if __name__ == '__main__':
    app.run(debug=True, port=5000)