// 9 машин каталога — значения 1:1 из CARS в public/script.js
export const CAR_SEED = [
  { id: 'gt3rs', name: 'Porsche 911 GT3 RS', category: 'sport', powerHp: 500, accel0100: '3,3', seats: 2, pricePerDay: 95000, deposit: 300000 },
  { id: 'ferrari-roma', name: 'Ferrari Roma', category: 'sport', powerHp: 620, accel0100: '3,4', seats: 4, pricePerDay: 120000, deposit: 300000 },
  { id: 'huracan', name: 'Lamborghini Huracán EVO', category: 'sport', powerHp: 640, accel0100: '2,9', seats: 2, pricePerDay: 150000, deposit: 300000 },
  { id: 'g63', name: 'Mercedes-AMG G 63', category: 'suv', powerHp: 585, accel0100: '4,5', seats: 5, pricePerDay: 65000, deposit: 150000 },
  { id: 'urus', name: 'Lamborghini Urus', category: 'suv', powerHp: 650, accel0100: '3,6', seats: 5, pricePerDay: 110000, deposit: 300000 },
  { id: 'range-rover', name: 'Range Rover', category: 'suv', powerHp: 530, accel0100: '4,6', seats: 5, pricePerDay: 45000, deposit: 100000 },
  { id: 's63', name: 'Mercedes-AMG S 63', category: 'business', powerHp: 612, accel0100: '3,5', seats: 5, pricePerDay: 50000, deposit: 100000 },
  { id: 'm5', name: 'BMW M5 Competition', category: 'business', powerHp: 625, accel0100: '3,3', seats: 5, pricePerDay: 40000, deposit: 100000 },
  { id: 'bentley', name: 'Bentley Continental GT', category: 'business', powerHp: 550, accel0100: '4,0', seats: 4, pricePerDay: 85000, deposit: 200000 },
] as const;
