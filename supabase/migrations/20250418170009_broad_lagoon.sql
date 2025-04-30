/*
  # Verimor API Yapılandırma Güncellemesi

  1. Yapılan Değişiklikler
     - Verimor API anahtarı güncellendi
     - Verimor API secret anahtarı güncellendi
     - Verimor PBX URL güncellendi
  
  2. Güvenlik
     - Verimor yapılandırma tablosunda RLS politikaları korundu
*/

-- Mevcut Verimor yapılandırmasını güncelle
UPDATE verimor_config
SET 
  api_key = 'Kb763f92e-bba4-40da-84af-a441169391f7',
  api_secret = 'Kb763f92e-bba4-40da-84af-a441169391f7', -- API key'i api_secret olarak da kullan
  pbx_url = 'https://api.bulutsantralim.com',
  updated_at = NOW()
WHERE id = (SELECT id FROM verimor_config LIMIT 1);