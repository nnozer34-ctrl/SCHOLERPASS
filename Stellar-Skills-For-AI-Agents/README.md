# Yapay Zeka Skill Dosyaları — Stellar Geliştirici Asistanı

Bu klasör, farklı yapay zeka platformlarının Stellar blockchain geliştirme konusunda
uzman gibi davranmasını sağlayan **hazır talimat dosyaları** içerir.

---

## Neden Bu Dosyalar Var?

Yapay zeka asistanları (ChatGPT, Claude, Gemini, Copilot) genel amaçlı araçlardır.
Stellar SDK'nın hangi sürümünü kullandığını, Freighter API'nin v4'te nasıl değiştiğini,
ya da Soroban işlem akışının hangi sırayla yürütülmesi gerektiğini **her soruda yeniden
anlatmak** zaman kaybıdır.

Bu dosyaları bir kez ilgili platforma yüklerseniz, yapay zeka:
- Doğru SDK versiyonlarını bilir
- Soroban işlem akışını aşama atlamadan uygular
- Freighter v4'ün nesne döndürdüğünü hatırlar
- Türkçe hata mesajları yazar
- Bu projenin dosya yapısına uygun öneriler verir

---

## Dosya Yapısı

```
ai-skills/
│
├── README.md                          ← Bu dosya (kullanım kılavuzu)
│
├── claude/
│   ├── CLAUDE.md                      ← Claude Code için (proje köküne koy)
│   └── stellar-system-prompt.md       ← Claude.ai Projects veya Claude API için
│
├── chatgpt/
│   ├── custom-instructions.md         ← ChatGPT Özel Talimatlar ayarı
│   └── gpt-system-prompt.md           ← Custom GPT (özel asistan) oluşturma
│
├── codex/
│   └── copilot-instructions.md        ← GitHub Copilot çalışma alanı talimatı
│
└── gemini/
    ├── gem-instructions.md            ← Gemini Gem (özel asistan) oluşturma
    └── api-system-instruction.md      ← Gemini API / AI Studio sistem talimatı
```

---

## Claude ile Kullanım

Claude; Anthropic'in yapay zeka asistanıdır. Claude Code (CLI), Claude.ai (web) ve API
olmak üzere 3 farklı kullanım şekli vardır.

### 1. Claude Code (Terminal / VS Code Eklentisi) — En Kolay

`CLAUDE.md` dosyası proje kök dizininde olduğunda Claude Code otomatik okur.

```bash
# Tek komutla kur
cp ai-skills/claude/CLAUDE.md ./CLAUDE.md
```

Bundan sonra terminalde `claude` komutunu çalıştırdığında, ya da VS Code'daki
Claude eklentisini kullandığında proje bağlamını zaten bilir.

**Ne zaman kullanılır:** Günlük kodlama, hata ayıklama, yeni bileşen ekleme.

---

### 2. Claude.ai Web Sitesi — Project Instructions

1. **claude.ai** adresine git → Sol menü → **"Projects"**
2. **"+ New Project"** → "Stellar Wallet Projesi" gibi bir isim ver
3. Proje sayfasında **"Project Instructions"** alanına tıkla
4. `ai-skills/claude/stellar-system-prompt.md` dosyasını aç, içindeki
   `## Sistem Promptu` bloğunu kopyala-yapıştır
5. Kaydet → Bu proje içindeki tüm sohbetlerde Claude Stellar uzmanı gibi davranır

**Ne zaman kullanılır:** Uzun tartışmalar, mimari kararlar, kod incelemesi.

---

### 3. Claude API (Python/JS)

```python
import anthropic

client = anthropic.Anthropic(api_key="API_ANAHTARINIZ")

# Sistem promptunu dosyadan oku (## Sistem Promptu bölümündeki metin)
system = open("ai-skills/claude/stellar-system-prompt.md").read()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    system=system,
    messages=[{"role": "user", "content": "Soruyu buraya yaz"}]
)
print(response.content[0].text)
```

**Ne zaman kullanılır:** Otomatik kod üretimi, CI/CD entegrasyonu, araç geliştirme.

---

## ChatGPT ile Kullanım

ChatGPT; OpenAI'ın ürettiği, dünyada en çok kullanılan yapay zeka asistanıdır.

### 1. Custom Instructions (Özel Talimatlar) — Tüm Sohbetlere Uygulanır

1. **chat.openai.com** adresine git → oturum aç
2. Sol alttaki kullanıcı ikonuna tıkla → **"Customize ChatGPT"**
3. **"Custom Instructions"** sekmesi açılır
4. `ai-skills/chatgpt/custom-instructions.md` dosyasını aç:
   - **"Bölüm 1"** metnini → **üst kutuya** yapıştır (sen kimsin?)
   - **"Bölüm 2"** metnini → **alt kutuya** yapıştır (nasıl yanıtlamalı?)
5. **"Save"** tıkla

Artık ChatGPT ile açtığın **tüm yeni sohbetlerde** bu talimatlar geçerli olur.

**Ne zaman kullanılır:** Kısa sorular, hata çözme, kavram açıklama.

---

### 2. Custom GPT — Kalıcı Özel Asistan

Custom GPT, belirli bir uzmanlık alanına odaklanmış özel bir ChatGPT versiyonudur.
Sol menüde kaydedilir ve istediğin zaman tekrar açabilirsin.

1. **chatgpt.com** → Sol menü → **"Explore GPTs"** → **"Create"**
2. **"Configure"** sekmesine geç (sağ taraf)
3. `ai-skills/chatgpt/gpt-system-prompt.md` dosyasını aç:
   - **Name:** `Stellar & Soroban Geliştirici Asistanı`
   - **Description:** Açıklama metnini kopyala
   - **Instructions:** Sistem promptunu kopyala-yapıştır
4. **"Save"** → **"Confirm"** → "Only me" seç (gizli) ya da "Anyone with a link" (paylaşılabilir)
5. Sol menüde **"My GPTs"** altında görünür

**Ne zaman kullanılır:** Uzun geliştirme seansları, proje danışmanlığı.

> **Not:** Custom GPT oluşturmak için ChatGPT Plus aboneliği gerekebilir.

---

## GitHub Copilot ile Kullanım

GitHub Copilot; kod editörüne (VS Code, JetBrains) entegre çalışan, satır satır
kod önerisi yapan bir yapay zeka aracıdır.

### Çalışma Alanı Talimatı (.github/copilot-instructions.md)

Bu dosya GitHub Copilot'a projenin bağlamını otomatik olarak öğretir.
Dosya `.github/` klasöründe olduğunda Copilot onu okur.

```bash
# Tek komutla kur
mkdir -p .github
cp ai-skills/codex/copilot-instructions.md .github/copilot-instructions.md

# Git'e ekle
git add .github/copilot-instructions.md
git commit -m "Copilot Stellar çalışma alanı talimatları eklendi"
```

Bundan sonra VS Code'da herhangi bir Stellar dosyasını açıp `Tab` ile tamamlama
önerisi aldığında, Copilot bu bağlamı zaten bilir.

### VS Code Copilot Chat için

VS Code'da `Ctrl+Shift+I` ile Copilot Chat'i aç ve şunu söyle:

```
@workspace Bu projedeki Soroban sözleşmesine yeni bir withdraw fonksiyonu ekle
@workspace frontend/src/lib/contract.ts dosyasındaki hatayı düzelt
@workspace /explain contracts/counter/src/lib.rs
```

**Ne zaman kullanılır:** Anlık kod tamamlama, refaktöring, yorum oluşturma.

> **Gereksinim:** GitHub Copilot aboneliği (aylık $10 bireysel / ücretsiz öğrenci planı mevcut).

---

## Gemini ile Kullanım

Gemini; Google'ın yapay zeka asistanıdır. Gem özelliği ile özel asistan oluşturulabilir.

### 1. Gem Oluşturma (Gemini Advanced) — Kalıcı Özel Asistan

1. **gemini.google.com** adresine git → oturum aç
2. Sol menüde **"Gems"** → **"New Gem"** tıkla
3. `ai-skills/gemini/gem-instructions.md` dosyasını aç:
   - **Gem name:** `Stellar & Soroban Geliştirici`
   - **Instructions:** "Gem Talimatları" bölümünü kopyala-yapıştır
4. **"Save"** tıkla
5. Sol menüde "My Gems" altında görünür → istediğin zaman aç

**Ne zaman kullanılır:** Tekrarlayan Stellar soruları, mimari tartışmalar.

> **Gereksinim:** Gemini Advanced (Google One AI Premium, aylık ~20 USD).

---

### 2. Google AI Studio (Ücretsiz) — Oturum Bazlı

Gems yoksa Google AI Studio ücretsiz alternatiftir.

1. **aistudio.google.com** adresine git → Google hesabıyla giriş yap
2. **"Create new prompt"** → **"Chat prompt"** seç
3. Sol taraftaki **"System instructions"** alanına:
   `ai-skills/gemini/gem-instructions.md` içindeki Gem talimatlarını kopyala-yapıştır
4. Model: **Gemini 2.0 Flash** seç (hızlı ve ücretsiz)
5. **"Save"** → "Stellar Dev" olarak kaydet

**Ne zaman kullanılır:** API anahtarı test etme, proje planlaması, Gems yoksa.

---

### 3. Gemini API / Python (Programatik)

```python
pip install google-generativeai

python - <<'EOF'
import google.generativeai as genai

genai.configure(api_key="GEMINI_API_ANAHTARINIZ")

system = """
Sen Stellar ve Soroban uzmanısın.
Testnet RPC: https://soroban-testnet.stellar.org
Passphrase: "Test SDF Network ; September 2015"
Akış: simulate → assemble → sign → send
Freighter v4 nesne döner: { address } = await getAddress()
"""

model = genai.GenerativeModel("gemini-2.0-flash", system_instruction=system)
chat = model.start_chat()
print(chat.send_message("Increment fonksiyonu nasıl çalışır?").text)
EOF
```

Daha kapsamlı kullanım için: `ai-skills/gemini/api-system-instruction.md`

---

## Hangi Yapay Zekayı Ne Zaman Kullanmalısın?

| Durum | Önerilen Araç |
|---|---|
| Terminalde kodlarken | Claude Code (`CLAUDE.md`) |
| VS Code'da yazarken | GitHub Copilot (`.github/`) |
| Hızlı soru-cevap | ChatGPT Custom Instructions |
| Uzun mimari tartışma | Claude.ai Project veya Custom GPT |
| Kod açıklaması/öğrenme | Gemini Gem |
| Otomasyona entegre | Claude API veya Gemini API |
| Ücretsiz seçenek | Google AI Studio + Gemini Flash |
| Öğrenci | GitHub Copilot (öğrenci planı ücretsiz) |

---

## Hızlı Kurulum Özeti

```bash
# 1. Claude Code için (otomatik okunur)
cp ai-skills/claude/CLAUDE.md ./CLAUDE.md

# 2. GitHub Copilot için (otomatik okunur)
mkdir -p .github
cp ai-skills/codex/copilot-instructions.md .github/copilot-instructions.md
git add .github/copilot-instructions.md && git commit -m "Copilot talimatları"

# 3. ChatGPT için → chat.openai.com → Customize ChatGPT
#    ai-skills/chatgpt/custom-instructions.md dosyasını aç ve içeriği yapıştır

# 4. Gemini için → gemini.google.com → Gems → New Gem
#    ai-skills/gemini/gem-instructions.md dosyasını aç ve içeriği yapıştır
```

---

## Skill Dosyalarını Güncelleme

Projeye yeni sözleşme veya bileşen eklendiğinde skill dosyalarını güncelle:

1. İlgili dosyayı aç (`claude/CLAUDE.md`, `codex/copilot-instructions.md` vb.)
2. Yeni fonksiyon, dosya yolu veya kural ekle
3. Yapay zekada kullandıysan sistemi yenile (sayfa yenile veya yeni sohbet aç)

---

## Lisans

Bu skill dosyaları MIT lisansı ile serbestçe kullanılabilir, değiştirilebilir ve paylaşılabilir.
