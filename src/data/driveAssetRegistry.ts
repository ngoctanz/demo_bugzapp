/**
 * BUGZ BrightUpGenZ — Cloud Drive Asset Registry (111 Original Project Assets)
 *
 * Lưu trữ toàn bộ ánh xạ 111 file tài nguyên gốc từ thư mục Google Drive của dự án
 * (https://drive.google.com/drive/folders/17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6)
 * để tuyệt đối KHÔNG lưu file ảnh/âm thanh nhị phân nặng vào kho mã nguồn Git/GitHub.
 *
 * Khi trình duyệt yêu cầu `/assets/drive/:filename`, `server.ts` sẽ:
 * 1. Phục vụ ngay lập tức từ bộ nhớ đệm ngoài repo (`/tmp/bugz-assets-cache/drive/:filename`) nếu đã có.
 * 2. Nếu chưa có trong `/tmp` (ví dụ khi vừa clone từ GitHub hoặc mới deploy container),
 *    tự động tải từ Google Drive theo `driveId` trong bảng này, lưu vào `/tmp/bugz-assets-cache`
 *    và trả về với `Cache-Control: public, max-age=31536000, immutable`.
 */

export const DRIVE_ASSET_IDS_NFC: Record<string, string> = {
  'Bệnh viện Phục hồi chức năng Việt Pháp.png': '1hXL4h0SM_BUhJ5t61L2mZkkl66uu8ZbQ',
  'mucluc.png': '1CMbGYtU_F3QCB1lbTliSspGmgVCsQALD',
  'Bao.png': '1C8c7qbHO6Cd3WhYkapbsSkdc-HYUBq0q',
  'in4 Thúy.png': '1WJCryU2SDZhcm7b4-ASiOuNQWGzykkDL',
  'Thúy CV.png': '1skwzHwT8hjObrub9mtGCTRYJOQ5LITIX',
  'team.png': '1ylsvmXPTgEPJwkKaOX-YVDDHVe5_6NgT',
  'Quan CV.png': '1udJ4eRg1UdrCav63P7cOxPvXq-XB1XfY',
  'chip CV.png': '1CmD5L8d-oKlBdGTW5QIPAttMk34K2zPY',
  'HC d1.png': '1AXnyEiL0805dCOD43hlSyTtMSoz1rRnW',
  'HC d2.png': '16Bg5yFoRkc8WCVxLnPWpWYWgD6u2HRel',
  'HC d3.png': '159mflUTwJmq6lT5eyNisbVDzIrnDp6y8',
  'HC d4.png': '1QDWzH0Cd1tH6ECtqC4V0QZte-zuUHjbu',
  'HC d5.png': '1qQLYEIElga-VXMhOd0JzW_2uGCnN67R3',
  'HC d6.png': '1D2pQupgspX70QRZ0b0j6QtWSpD_iQXXv',
  'HC d7.png': '1VTTt0xycL2jM0OqJ0DVlCeHZ2Ls3U-GW',
  'HC d8.png': '1okEbrU9WunQi5yMZ1M8pbsvNNlirSL7l',
  'HC d9.png': '1wjiohLfSiPZ3M4zryNESzdqTs9o4CEqk',
  'HC d10.png': '1DuXaVvKgtKdLLeS2un2LWP-akw8vwp_R',
  'HC d11.png': '1_fXe3kwqUucnz3XohhJot_cJNiwhZW2r',
  'HC d12.png': '10FI4j9uFvdh-cVhDeTlqV0iA5LUJW6N9',
  'HC d13.png': '1SzaNWvIrQHwXOeS75i-4EA4tqYA3Q81t',
  'HC d14.png': '1clxvrQhM5FcF-U0X3yTLg-BOwcgDVt_T',
  'HC d15.png': '1Eninv07piitL3QNGRMxrOUqOKa7F_hVO',
  'HC d16.png': '1OtN5uMrNLSQJ45CETxy-5mLNKiUZll7R',
  'HC d17.png': '17s2Jfs2NEucYRneeDHy6EyvHoZ36LJDq',
  'HC d18.png': '15Uj5fenZNE0blE2tc16x37jaaRvclpKb',
  'HC d19.png': '1Xd-rlZuBbC7aZHNVQ30aryxfGuTe3EJd',
  'HC d20.png': '1ssBAjXpJ2Oh4o73qorwxtiAyUzyCxXWu',
  'HC d21.png': '1q9TTzhEHxSTkwAsM9-RewI5pozPXJ85v',
  'HC d22.png': '1BCGVyPxXuVIVVlLSABw5hQwOlIxJGncJ',
  'HC d23.png': '1gGGnGW53m2uqzkaLN-1EUEpGPmmpqutX',
  'HC d24.png': '1llrC3LUQSs9VJTfcEiiqvAhSZs1wf5Rd',
  'HC d25.png': '1R7mB_paq7EvH752cRgf5NfaGk5rQNG0b',
  'HC d26.png': '1gEH06tYOGXAikeDN4stcQp64WigPvCyA',
  'HC d27.png': '1Mey-84FKEjcpooHQ-a-_ELrOhx6kpppK',
  'day1.png': '1H9-RBf8qY2-vX6ZeFxEki8SeqLQ3Zfjl',
  'day2.png': '1IUgyKrnQlzklKo4jYOk57ru1SvATS79a',
  'day3.png': '12XXdEoMzDfW5JYglr8wDuV_lQk6EqvSh',
  'day4.png': '1vqBDan0ZbaE7ai9TgskoXamRwRqDjlhI',
  'day5.png': '1EJSl7P7q8Xi_fpn9M5-Wj5XgmqRnxbFy',
  'day6.png': '1uhL6Pd3VFFv8JjqzCH5G3VFrnHgc4kPd',
  'day7.png': '15y9V_pUsy6_SXzqgtrnkIhRxibCvZIo5',
  'day8.png': '1IUAZdeZ2Pb1qeYcMRGOmVJ7NvxieYzC1',
  'day9.png': '1nkn4C9tZiTZ3xzc92wS0HjEXD5kSIm-0',
  'day10.png': '1tMo9CmuDya8H5vKmzk9IAjKIYyyX61Tm',
  'day11.png': '1pS9sj2R7V-Yst3nGS-RjMhIVGp8yW2Sn',
  'day12.png': '1nmnRWh2aCE0IXS64uPn75TSmCpzRnpR3',
  'day13.png': '1vOlyW6L9AKoWuUlm22Zxg5VkikC5epvO',
  'day14.png': '1plHixgYjuL3MPdWc9FLjQJ9zj4s-1M4T',
  'day15.png': '1I35cnQHKxiD3xrKtmRqtCkU1mx4c1q5c',
  'day16.png': '1T45pvRnnwghkb_CZ1tDUu5K1Nyye2rD1',
  'day17.png': '12m-jHiULkrQFBIYOeqLEgZI45Ong5am3',
  'day18.png': '1mFd9Y6q44PPIYqImuCsGjx0jNeFUJ8Ww',
  'day19.png': '1S1Jj7iO_1QfG4YRv7c4yIp18FmQUcLtp',
  'day20.png': '1ELNjR2N7S28zm5VxwwglrCA-xiWfzlp3',
  'day21.png': '1HEOM0rxNyT9OKzuegzHr7kfMDgSFAF-U',
  'day22.png': '1d8B-K0YEbVC0jlYva1IwB6cGsHwfyfcv',
  'day23.png': '11u_cuenEdFq7OZOQAu9aTtvEMWDbRYTz',
  'day24.png': '1guOb_VF1tseCb37hnlQIKz-jyprEtTRQ',
  'day25.png': '1l_-6WoQ_0boQAzg9RfA1NHiJX68zctgh',
  'day26.png': '1iwxrIahwyP6qQ464vl4geLh-b2gXaDo9',
  'day27.png': '1S2e9T28pZfUVTgI4i_yfqq6V8ERH383q',
  'day28.png': '13fRcrc8X-cCY04R4eUGKw8_PhlkdrK_e',
  'in4 d1.png': '1zpOeK5-Os7rfW1EKNnB3S7QpqBplwV5e',
  'in4 d2.png': '1BmLo787PUleBPdA0_CTUBMflSqZ8wsZE',
  'in4 d3.png': '1WQ0PKAsHkjalzcuh3K3-tKpgGgyfCTfn',
  'in4 d4.png': '12uP3wtH6Wi2ABucIiZy873nE0RqlFXqi',
  'in4 d5.png': '1TO6qZWinxMbGpk4uhwxImFSGqgL-uKbu',
  'in4 d6.png': '1T5Ylz0OrDVLa1qq-yj4LQqzPB0I69elR',
  'in4 d7.png': '1DskKqRyWko87TSbsDx1ZkBMvzLpWTBDA',
  'in4 d8.png': '1O0BXVNQftPNu0q8AMl0t9bZds_ywQ2ZT',
  'in4 d9.png': '1otyTT4VOzlwDHJuCgH_YAgSqy5MLoU2g',
  'in4 d10.png': '1Ga9zjOFezHxo3-IUtNcN1xSHC_pT9ZrX',
  'in4 d11.png': '15_STTw0XTZXnJpcX0nEWriTB2ERtlkQN',
  'in4 d12.png': '1PjXTSlfhMKw4g_W9fJf8FwadnanTInMm',
  'in4 d13.png': '1FK1t6fLf0NTTC0AfVhKSv-veWmGokVbO',
  'in4 d14.png': '1aT0UcDGRHBP6K-IkPNsKy4Eb5pNd2hMd',
  'in4 d15.png': '1Ty56MXHRZKQTbVbKWPiCFdaD4amvvRCW',
  'in4 d16.png': '1EdCGrDf1vlyRGwU_bN0oxI7Zm6AcM2aS',
  'in4 d17.png': '1xd_Qpy6MBKz_ZGnd5O1UjS_pgCYxrc5s',
  'in4 d18.png': '1VSVtnAYJpCdSORIm68NVRChS_UjRIOiW',
  'in4 d19.png': '1Z2MNSEWod2TOuLuwl8DHHuAsU2bES0tT',
  'in4 d20.png': '1KmV3ohrBYIaGgFIBYEjMcaLLgSEYwI0z',
  'in4 d21.png': '1flhX8SgHkkyKDrcbyAXkav27GoP6XscG',
  'in4 d22.png': '1kQZUEvVPYYyEWPCnRbkfuCOHj9kh15WL',
  'in4 d23.png': '1wsNQIq_bIKNDJwUEWWh44yIiV4Fa5PKM',
  'in4 d24.png': '1_nFqzdFmwmA5eDnORnPafwnutyaADBlE',
  'in4 d25.png': '1WKcaQhOiIue1hia77h08tTJftyuIOjiR',
  'in4 d26.png': '15WFbxpapxaL5Vu3QcC_v-8kKlh5fv45s',
  'home.png': '10sXGqKFKDTNsFEfIheb221lObJryHVXE',
  'click.mp3': '1zN4kv4McZgo9lq7LlHHK2yAnaBQY0F46',
  'leade CV.png': '1Bd51zAr7fbYZJwE-wMwgtoQo8Kd2W2bH',
  'in4 chip.png': '1Jolhun-iHpKUuDgVSQ5DTSosmT1EZBII',
  'in4 leade.png': '1UW88hPkscGrwW4cbY7DZ84Gd5vehJySP',
  'in4 Quan.png': '1CKIvEHkKxNoh3OiKvzPFGEN9xMQDmBSo',
  'Tuan1.png': '1G9Py5hn3W3jVBdPJdDEKv4UV7h5W8Lry',
  'Tuan2.png': '1I2_dvW3OT19QE2WtZSlIxJlw9uaFgT0g',
  'Tuan3.png': '129HfWqOS3urEGFc2fpYhjRfj1CR4NQ6n',
  'Tuan4.png': '1Eozisvm2UaEVVnhkN_vVjy7z6KJPbspj',
  'Trung tâm Y tế khu vực Thanh Khê.png': '13YHMKD4Lxj2cKtbhOXwuzvzLb4jRZ1sX',
  'Trung tâm Y tế khu vực Hải Châu.png': '1GL4C5LHZ4jXTbv15hizFklxkteJD2A_q',
  'Trung tâm Y tế khu vực Sơn Trà.png': '1Lmwgji1YiG80gpY5rl4ZoewUifsT4Ohp',
  'fa.png': '1YlBacdG9b34RWokJgLPCJwDcEgTppiCf',
  'full flashcard.png': '1pXDx90HFAV-7oVSFmHv5m6_C8F8qUWdG',
  'Tiến trình thực hiện.png': '1CVRJi6ASGZpLxasX8Bm3ks1uKOo4pnKr',
  'flashcard 1.png': '1CxBudLeR3NJqXL2xLKkJ4L0J7XVOAVKs',
  'bg.png': '1dC97U-W3aqXUMMtQ8FUgXxF2VsFeJjlL',
  'fl2.png': '1Tn14XkwC0nBgO-TGqJWN64HXK1Dcn0XA',
  'flcar.png': '1xJILZFn-90fUX5D6p4295dtJehcVAZ3-',
  'logo.jpg': '1GPNkVdSpMJloHyqd_gLdED061crJH0T8',
  'logo1.png': '1gQHY1UhxP95eR_2lnzkjdeVuIKY_4wre',
  // 28 Ảnh Thumbnail Cover theo ngày từ thư mục Google Drive:
  // https://drive.google.com/drive/folders/1EggVzvXD4fh2i8De52TBSnXCQ3KP0b3v?usp=sharing
  'cover d1.png': '15FjqBJi-a0JsQPztsxg48hNhiQ8ylpYZ',
  'cover d2.png': '1LJCD5SjKPoW_9Nqs_zwSH43FSPL-nD4R',
  'cover d3.png': '1MnXzPVl8wesaKfL-FXtT9mRIgLMdbRmr',
  'cover d4.png': '1VrJtUtbtdEBhjSiB978uH9jaE-mnMKqb',
  'cover d5.png': '1bYT23SFJeYHAIbrSApUjZciB73JgcWO7',
  'cover d6.png': '1K2JI1c8muHQMOuJbtb74SNGuU2DWC9TZ',
  'cover d7.png': '1xIuucK0bIJ8qAndLDVrxARrdFd0BJmWH',
  'cover d8.png': '1IvvITv6TJyRBXis2s_5_6A0Z0Kb4wyQx',
  'cover d9.png': '11VVOj7Xi7X2-A30yv6mPD2cmWnC5Qiel',
  'cover d10.png': '1YFNV96OUnYqFXtXC1Ff6dJ3It40Fr_nG',
  'cover d11.png': '1kCyjj3s_XYhIF4gEPK1J9iH0wzxOeViv',
  'cover d12.png': '1f-VlflMeYRAQOjWhrLaFCd1eclD84Rz2',
  'cover d13.png': '1YK9U6a_kDwyJ58MBAZIA4yLurQpoOE2o',
  'cover d14.png': '1GHEJji3GOwW7FBH0JcucRTLpcK0eCWq2',
  'cover d15.png': '1y5OcRnjmwGWm29SyHyuMVzT593zYmBGu',
  'cover d16.png': '17IH1Xfg0JdW1Cm45ggKUNio2qVgHtfRy',
  'cover d17.png': '1K5NNgFN219R70Aj3OKlcSDmOwNACzmZb',
  'cover d18.png': '1ZaOIA8yhU1HFwBP94dm_4bhx0jMI8qM4',
  'cover d19.png': '1pNdX9OEvNkruGv8rI6X7_7caf8AFNi-I',
  'cover d20.png': '1-ZuSl75ov4aanzdrJSVZIoyJoxNS3rhT',
  'cover d21.png': '1jBYjDV2EMd8D_ZK39lA2c6bQFuiOTwLT',
  'cover d22.png': '1szSZ81ykgU0YMm-W69kTWDtejdZ9DDBs',
  'cover d23.png': '1gF7EkFtyJIsu8FRJccEf0cWIsWYs0OIr',
  'cover d24.png': '13dWT_bx0z83wN8Zg60Q4c0vNskXJYOU7',
  'cover d25.png': '1BFI3UFJy57XaEh8_lBQZoKzA-Krb8Xzu',
  'cover d26.png': '1R-T6jCDDBwmXl8lp-keob2wumSiPSIqF',
  'cover d27.png': '1s7_GgluQn9J6vWKWQ5gU5bW9i0NIInKJ',
  'cover d28.png': '1jx3oUZuThc-ay-KkPrj5pG0Agp3RyMr0',
  // 4 Ảnh Thumbnail Cover 16:9 theo tuần & Ảnh Thumbnail Cover Bảng tổng hợp Flashcard 28 ngày từ thư mục Google Drive:
  // https://drive.google.com/drive/folders/1EggVzvXD4fh2i8De52TBSnXCQ3KP0b3v?usp=sharing
  'Tuan 1.png': '1iByelGyZa8Sw9Cc--ASM7r5MxnUxYiEN',
  'Tuan 2.png': '1nF2ERZSbOrTkgq-V5aUoofZDM9dZ9AwO',
  'Tuan 3.png': '1KvospOZF2T4TyVnageSx7RlSW-oNVHmK',
  'Tuan 4.png': '1eVaoNMdkgzTEErw7MSKMiIbm6KCkKFSF',
  'Flashcard full 28 ngay.png': '1pveHfhln8bTL2DQB49SrZGQNKliM7ldP',
};

export const FLASHCARD_COVER_DRIVE_ID = '1pveHfhln8bTL2DQB49SrZGQNKliM7ldP';

export const WEEK_COVER_DRIVE_IDS: Record<1 | 2 | 3 | 4, string> = {
  1: '1iByelGyZa8Sw9Cc--ASM7r5MxnUxYiEN',
  2: '1nF2ERZSbOrTkgq-V5aUoofZDM9dZ9AwO',
  3: '1KvospOZF2T4TyVnageSx7RlSW-oNVHmK',
  4: '1eVaoNMdkgzTEErw7MSKMiIbm6KCkKFSF',
};

export const DAY_COVER_DRIVE_IDS: Record<number, string> = {
  1: '15FjqBJi-a0JsQPztsxg48hNhiQ8ylpYZ',
  2: '1LJCD5SjKPoW_9Nqs_zwSH43FSPL-nD4R',
  3: '1MnXzPVl8wesaKfL-FXtT9mRIgLMdbRmr',
  4: '1VrJtUtbtdEBhjSiB978uH9jaE-mnMKqb',
  5: '1bYT23SFJeYHAIbrSApUjZciB73JgcWO7',
  6: '1K2JI1c8muHQMOuJbtb74SNGuU2DWC9TZ',
  7: '1xIuucK0bIJ8qAndLDVrxARrdFd0BJmWH',
  8: '1IvvITv6TJyRBXis2s_5_6A0Z0Kb4wyQx',
  9: '11VVOj7Xi7X2-A30yv6mPD2cmWnC5Qiel',
  10: '1YFNV96OUnYqFXtXC1Ff6dJ3It40Fr_nG',
  11: '1kCyjj3s_XYhIF4gEPK1J9iH0wzxOeViv',
  12: '1f-VlflMeYRAQOjWhrLaFCd1eclD84Rz2',
  13: '1YK9U6a_kDwyJ58MBAZIA4yLurQpoOE2o',
  14: '1GHEJji3GOwW7FBH0JcucRTLpcK0eCWq2',
  15: '1y5OcRnjmwGWm29SyHyuMVzT593zYmBGu',
  16: '17IH1Xfg0JdW1Cm45ggKUNio2qVgHtfRy',
  17: '1K5NNgFN219R70Aj3OKlcSDmOwNACzmZb',
  18: '1ZaOIA8yhU1HFwBP94dm_4bhx0jMI8qM4',
  19: '1pNdX9OEvNkruGv8rI6X7_7caf8AFNi-I',
  20: '1-ZuSl75ov4aanzdrJSVZIoyJoxNS3rhT',
  21: '1jBYjDV2EMd8D_ZK39lA2c6bQFuiOTwLT',
  22: '1szSZ81ykgU0YMm-W69kTWDtejdZ9DDBs',
  23: '1gF7EkFtyJIsu8FRJccEf0cWIsWYs0OIr',
  24: '13dWT_bx0z83wN8Zg60Q4c0vNskXJYOU7',
  25: '1BFI3UFJy57XaEh8_lBQZoKzA-Krb8Xzu',
  26: '1R-T6jCDDBwmXl8lp-keob2wumSiPSIqF',
  27: '1s7_GgluQn9J6vWKWQ5gU5bW9i0NIInKJ',
  28: '1jx3oUZuThc-ay-KkPrj5pG0Agp3RyMr0',
};

const NORMALIZED_LOOKUP: Map<string, { canonicalName: string; driveId: string }> = new Map();
for (const [name, driveId] of Object.entries(DRIVE_ASSET_IDS_NFC)) {
  const nfc = name.normalize('NFC');
  const nfd = name.normalize('NFD');
  NORMALIZED_LOOKUP.set(nfc, { canonicalName: nfc, driveId });
  NORMALIZED_LOOKUP.set(nfd, { canonicalName: nfc, driveId });
  NORMALIZED_LOOKUP.set(nfc.toLowerCase(), { canonicalName: nfc, driveId });
  NORMALIZED_LOOKUP.set(nfd.toLowerCase(), { canonicalName: nfc, driveId });

  // Hỗ trợ alias đuôi .webp cho mọi file ảnh .png/.jpg để trình duyệt gọi /assets/drive/cover%20d1.webp hoặc /assets/drive/Tuan%201.webp
  const webpAlias = nfc.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  const webpAliasNfd = webpAlias.normalize('NFD');
  NORMALIZED_LOOKUP.set(webpAlias, { canonicalName: nfc, driveId });
  NORMALIZED_LOOKUP.set(webpAliasNfd, { canonicalName: nfc, driveId });
  NORMALIZED_LOOKUP.set(webpAlias.toLowerCase(), { canonicalName: nfc, driveId });
  NORMALIZED_LOOKUP.set(webpAliasNfd.toLowerCase(), { canonicalName: nfc, driveId });
}

export function resolveDriveAssetEntry(
  rawFilename: string
): { canonicalName: string; driveId: string } | null {
  try {
    const decoded = decodeURIComponent(rawFilename).trim();
    return (
      NORMALIZED_LOOKUP.get(decoded.normalize('NFC')) ||
      NORMALIZED_LOOKUP.get(decoded.normalize('NFD')) ||
      NORMALIZED_LOOKUP.get(decoded.normalize('NFC').toLowerCase()) ||
      null
    );
  } catch {
    const trimmed = rawFilename.trim();
    return (
      NORMALIZED_LOOKUP.get(trimmed.normalize('NFC')) ||
      NORMALIZED_LOOKUP.get(trimmed.normalize('NFD')) ||
      null
    );
  }
}

export function getDriveDirectDownloadUrls(
  driveId: string,
  options?: {
    isAudio?: boolean;
    canonicalName?: string;
    preferWebp?: boolean;
    cloudCdnBaseUrl?: string;
  }
): string[] {
  const isAudio = Boolean(options?.isAudio);
  const canonicalName = options?.canonicalName || '';
  const preferWebp = options?.preferWebp !== false;
  const cloudBase = (options?.cloudCdnBaseUrl || '').trim().replace(/\/+$/, '');

  const urls: string[] = [];

  // 1. Nếu đã cấu hình Cloud Storage / CDN riêng (Firebase Storage hoặc Cloud CDN), ưu tiên số 1
  if (cloudBase && canonicalName) {
    urls.push(`${cloudBase}/${encodeURIComponent(canonicalName)}`);
  }

  if (isAudio) {
    urls.push(
      `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`,
      `https://drive.google.com/uc?export=download&id=${driveId}`
    );
    return urls;
  }

  // 2. Ưu tiên Google Fast Image Serving Engine CDN (lh3.googleusercontent.com) với hậu tố `-rw` (Request WebP)
  // và dự phòng bộ nén WebP chuẩn cho các Drive ID có ký tự đặc biệt (`--`), giúp toàn bộ ảnh luôn đạt chuẩn image/webp.
  const lowerName = canonicalName.toLowerCase();
  const isLargeComposite = lowerName.includes('full flashcard');
  const isWeekCoverThumbnail = /^tuan\s+[1-4]\.png$/i.test(lowerName);
  const isDayCoverThumbnail = lowerName.startsWith('cover d');
  const maxWidth = isLargeComposite
    ? 2400
    : isWeekCoverThumbnail
    ? 1280
    : isDayCoverThumbnail
    ? 960
    : 1600;

  const rawDriveDownloadUrl = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;

  if (preferWebp) {
    urls.push(
      `https://lh3.googleusercontent.com/d/${driveId}=w${maxWidth}-rw`,
      `https://wsrv.nl/?url=${encodeURIComponent(rawDriveDownloadUrl)}&output=webp&w=${maxWidth}&q=84`
    );
  }
  urls.push(
    `https://lh3.googleusercontent.com/d/${driveId}=w${maxWidth}`,
    rawDriveDownloadUrl,
    `https://drive.google.com/uc?export=download&id=${driveId}`
  );
  return urls;
}
