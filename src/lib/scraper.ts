
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export interface ScrapedItem {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  url: string;
  rating?: number;
  reviewCount?: number;
}

/**
 * 쿠팡 브라우저 엔진 (실제 브라우저 가동)
 */
async function scrapeCoupangWithBrowser(url: string, cookie: string): Promise<ScrapedItem[]> {
  console.log('[Squirrel-Browser] Launching Stealth Browser Raid...');
  
  // 1. [실전 기동] 동적 로드로 모듈 평가 오류 원천 차단
  let puppeteer;
  try {
    puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    if (!puppeteer._stealthApplied) {
      puppeteer.use(StealthPlugin());
      puppeteer._stealthApplied = true;
    }
  } catch (err) {
    console.error('[Squirrel-Error] Browser modules not ready:', err);
    return [];
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    // 타임아웃 방지용
    await page.setDefaultNavigationTimeout(30000);

    if (cookie) {
      const cookies = cookie.split(';').map(c => {
        const [name, ...value] = c.trim().split('=');
        return { name, value: value.join('='), domain: '.coupang.com', path: '/' };
      }).filter(c => c.name && c.value);
      await page.setCookie(...cookies as any);
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 데이터 추출 (DOM 로드 대기)
    try {
        await page.waitForSelector('.goldbox-card, .goldbox-item, .baby-product, li.category-best-item', { timeout: 10000 });
    } catch (e) {
        console.warn('[Squirrel-Browser] Selectors not found on time, proceeding to backup.');
    }

    const items = await page.evaluate(() => {
      const results: any[] = [];
      const selectors = ['.goldbox-card', '.goldbox-item', '.baby-product', 'li.category-best-item'];
      
      for (const sel of selectors) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          elements.forEach(el => {
            if (results.length >= 12) return;
            const name = el.querySelector('.name')?.textContent?.trim() || 
                         el.querySelector('.title')?.textContent?.trim() ||
                         el.querySelector('dd.descriptions .name')?.textContent?.trim();
                         
            const price = el.querySelector('.price-value')?.textContent?.trim() ||
                          el.querySelector('.total-price .number')?.textContent?.trim();
                          
            const imageUrl = el.querySelector('img')?.getAttribute('src') || 
                             el.querySelector('img')?.getAttribute('data-img-src');
            const link = el.querySelector('a')?.getAttribute('href');
            
            if (name && price) {
              results.push({
                id: `br_${Math.random().toString(36).substring(7)}`,
                name,
                price: price.includes('원') ? price : price + '원',
                imageUrl: imageUrl?.startsWith('//') ? 'https:' + imageUrl : imageUrl,
                url: link?.startsWith('http') ? link : 'https://www.coupang.com' + link,
                rating: 4.5,
                reviewCount: 100
              });
            }
          });
          break;
        }
      }
      return results;
    });

    return items;
  } catch (e) {
    console.error('[Squirrel-Browser] Raid Failed:', e);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * 쿠팡의 방벽을 넘는 '스텔스 하이브리드 v3' 스크래퍼
 */
export async function scrapeCoupangBest(type: 'best' | 'goldbox' = 'best', cookie: string = ''): Promise<ScrapedItem[]> {
  const dataPath = path.join(process.cwd(), 'src', 'data', 'trends.json');
  
  const getVaultItems = (): ScrapedItem[] => {
    try {
      if (fs.existsSync(dataPath)) {
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      }
    } catch (e) {
      console.error('[Squirrel-Vault] Read Failed:', e);
    }
    return [];
  };

  const url = type === 'goldbox' 
    ? 'https://www.coupang.com/np/goldbox' 
    : 'https://www.coupang.com/np/categories/best';

  try {
    console.log(`[Squirrel-Intelligence] Attempting Axios Raid on ${type}...`);
    
    // 1차 시도: Axios (가장 빠름)
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Cookie': cookie || 'PCID=1234567890;',
      },
      timeout: 5000
    });

    const $ = cheerio.load(response.data);
    const items: ScrapedItem[] = [];
    const selectors = type === 'goldbox' 
      ? ['.goldbox-card', '.goldbox-item', '.baby-product'] 
      : ['.pdp-link', '.baby-product', 'li.category-best-item'];

    for (const selector of selectors) {
      $(selector).each((i, el) => {
        if (items.length >= 12) return;
        const $el = $(el);
        const name = $el.find('.name').text().trim() || $el.find('.title').text().trim();
        const priceStr = $el.find('.price-value').first().text().trim().replace(/,/g, '');
        if (name && priceStr) {
          let imageUrl = $el.find('img').attr('data-img-src') || $el.find('img').attr('src');
          if (imageUrl?.startsWith('//')) imageUrl = 'https:' + imageUrl;
          const relativeUrl = $el.find('a').attr('href');
          items.push({
            id: `cp_${Math.random().toString(36).substring(7)}`,
            name,
            price: parseInt(priceStr).toLocaleString() + '원',
            imageUrl: imageUrl || 'https://via.placeholder.com/200',
            url: relativeUrl ? (relativeUrl.startsWith('http') ? relativeUrl : `https://www.coupang.com${relativeUrl}`) : '#',
            rating: 4.5,
            reviewCount: 100
          });
        }
      });
      if (items.length > 5) break;
    }

    if (items.length > 0) return items;
    throw new Error('Axios returned empty results (Possibly blocked)');

  } catch (error: any) {
    console.warn(`[Squirrel-Warning] Axios Raid failed (${error.message}). Escalating to Browser Engine...`);
    
    // 2차 시도: Puppeteer (확실함, 하지만 느림)
    try {
      const browserItems = await scrapeCoupangWithBrowser(url, cookie);
      if (browserItems.length > 0) return browserItems;
    } catch (browserError) {
      console.error('[Squirrel-Error] Browser Engine also failed.');
    }

    // 최종 단계: 로컬 보관소 개방
    console.log('[Squirrel-Fallback] Opening Underground Vaults...');
    return getVaultItems();
  }
}

/**
 * 아마존 트렌드 스크래퍼 (글로벌 타겟)
 */
export async function scrapeAmazonBest(): Promise<ScrapedItem[]> {
    return [
        {
            id: 'amz_1',
            name: 'Stanley Quencher H2.0 FlowState 40oz (Demo)',
            price: '$45.00',
            imageUrl: 'https://m.media-amazon.com/images/I/71YfX6m+i+L._AC_SX679_.jpg',
            url: '#',
            rating: 4.8,
            reviewCount: 35000
        }
    ];
}

/**
 * 테무 트렌드 스크래퍼 (시뮬레이션)
 */
export async function scrapeTemuBest(): Promise<ScrapedItem[]> {
    return [
        {
            id: 'temu_1',
            name: 'Temu Magnetic Chess Game (Viral)',
            price: '₩12,900',
            imageUrl: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=200&h=200&fit=crop',
            url: '#',
            rating: 4.9,
            reviewCount: 1500
        },
        {
            id: 'temu_2',
            name: 'Portable Mini Sealing Machine',
            price: '₩3,500',
            imageUrl: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=200&h=200&fit=crop',
            url: '#',
            rating: 4.5,
            reviewCount: 2800
        }
    ];
}

/**
 * 알리익스프레스 트렌드 스크래퍼 (시뮬레이션)
 */
export async function scrapeAliBest(): Promise<ScrapedItem[]> {
    return [
        {
            id: 'ali_1',
            name: 'Baseus 65W GaN Charger 5 Pro',
            price: '₩35,000',
            imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a362e7170?w=200&h=200&fit=crop',
            url: '#',
            rating: 4.8,
            reviewCount: 9500
        }
    ];
}
/**
 * 🐿️ 부장의 구글 이미지 특수 수색대 (이미지 주소 추출)
 */
export async function scrapeGoogleImages(query: string): Promise<string[]> {
  console.log(`[Squirrel-Intelligence] Google Image Raid for: ${query}`);
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&safe=active`;
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const images: string[] = [];
    
    // 구글 이미지 검색 결과에서 원본 이미지 소스(혹은 썸네일)를 긁어옵니다.
    $('img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && src.startsWith('http') && !src.includes('googlelogo')) {
        images.push(src);
      }
      if (images.length >= 10) return false;
    });
    
    return images;
  } catch (e) {
    console.error('[Squirrel-Error] Google Image Raid Failed:', e);
    return [];
  }
}

/**
 * 🐿️ 부장의 웹 정보 수집 부대 (텍스트 정보 추출)
 */
export async function scrapeWebInfo(query: string): Promise<{ title: string, snippet: string, link: string }[]> {
  console.log(`[Squirrel-Intelligence] Web Info Raid for: ${query}`);
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const results: { title: string, snippet: string, link: string }[] = [];
    
    // 검색 결과 제목과 요약 정보를 긁어옵니다.
    $('div.g').each((i, el) => {
      const title = $(el).find('h3').text();
      const snippet = $(el).find('div.VwiC3b').text();
      const link = $(el).find('a').attr('href');
      
      if (title && snippet && link) {
        results.push({ title, snippet, link });
      }
      if (results.length >= 5) return false;
    });
    
    return results;
  } catch (e) {
    console.error('[Squirrel-Error] Web Info Raid Failed:', e);
    return [];
  }
}

/**
 * 🐿️ 부장의 오늘의 이슈 추적 부대 (네이버 뉴스 활용)
 */
export async function scrapeTodayIssues(): Promise<string[]> {
  console.log('[Squirrel-Intelligence] Today Issue Raid starting...');
  const url = 'https://search.naver.com/search.naver?where=news&query=오늘의이슈';
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const issues: string[] = [];
    
    $('.news_tit').each((i, el) => {
      issues.push($(el).text().trim());
      if (issues.length >= 10) return false;
    });
    
    return issues;
  } catch (e) {
    console.error('[Squirrel-Error] Today Issue Raid Failed:', e);
    return [];
  }
}
