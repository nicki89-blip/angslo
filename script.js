// 🔗 Seznam naborov (lokalne datoteke v istem folderju)
const DATASETS = [
  { id: "all",   name: "Vse besede", url: "english_words.json" },
  { id: "unit1", name: "Unit 1",     url: "unit1.json" },
  { id: "unit2", name: "Unit 2",     url: "unit2.json" }
];
const SELECT_KEY = "anki_dataset_id";

function buildDatasetSelect(){
  const sel = document.getElementById("dataset");
  sel.innerHTML = "";
  DATASETS.forEach(ds => {
    const opt = document.createElement("option");
    opt.value = ds.id;
    opt.textContent = ds.name;
    sel.appendChild(opt);
  });
  const saved = localStorage.getItem(SELECT_KEY);
  if (saved && DATASETS.find(d => d.id === saved)){
    sel.value = saved;
  }
}

function currentDataset(){
  const sel = document.getElementById("dataset");
  const id = sel.value;
  return DATASETS.find(d => d.id === id) || DATASETS[0];
}

// 🔀 premešaj polje (Fisher–Yates)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchCards(url){
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error("Napaka pri prenosu (" + resp.status + ")");
  const data = await resp.json();

  // 1. THIS RANDOMIZES THE LIST ON LOAD ONLY
  // This creates the "shuffled deck" for this session
  const shuffled = shuffle([...data]);

  // mapiramo v strukturo kartic
  return shuffled.map((item, index) => {
    const valSlo = item.question ?? item.slovenian ?? "";
    const valEng = item.answer   ?? item.english   ?? "";

    // 50/50 chance:
    // true = Slovenian on front, English on back
    // false = English on front, Slovenian on back
    const isSloToEng = Math.random() < 0.5;

    return {
      id: index,
      front: isSloToEng ? valSlo : valEng,
      back:  isSloToEng ? valEng : valSlo,
      status: "unknown"
    };
  });
}

function setLoadingUI(loading){
  const front = document.getElementById("cardFront");
  const back  = document.getElementById("cardBack");
  const buttons = ["prevBtn","nextBtn","knowBtn","partialBtn","unknownBtn"]
    .map(id => document.getElementById(id));
  buttons.forEach(b => b.disabled = loading);

  if (loading){
    front.textContent = "Nalagam kartice…";
    back.textContent  = "Prosim počakaj 🙂";
  }
}

class AnkiApp {
  constructor(cards){
    this.cards = cards;
    this.currentIndex = 0;
    this.currentFilter = 'all';
    this.isFlipped = false;
    this.filteredCards = [...this.cards];

    this.initializeElements();
    this.setupEventListeners();
    this.updateDisplay();
    this.updateStats();
    this.enableUI();
  }

  initializeElements(){
    this.cardElement = document.getElementById('flashcard');
    this.cardFront = document.getElementById('cardFront');
    this.cardBack = document.getElementById('cardBack');
    this.cardCounter = document.getElementById('cardCounter');
    this.cardContainer = document.getElementById('cardContainer');
    this.noCardsMessage = document.getElementById('noCardsMessage');
    this.progressBar = document.getElementById('progressBar');

    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    this.knowBtn = document.getElementById('knowBtn');
    this.partialBtn = document.getElementById('partialBtn');
    this.unknownBtn = document.getElementById('unknownBtn');

    this.filterBtns = document.querySelectorAll('.filter-btn');
    this.totalCardsSpan = document.getElementById('totalCards');
    this.knownCardsSpan = document.getElementById('knownCards');
    this.partialCardsSpan = document.getElementById('partialCards');
    this.unknownCardsSpan = document.getElementById('unknownCards');
    this.successRateSpan = document.getElementById('successRate');
  }

  enableUI(){
    this.prevBtn.disabled = false;
    this.nextBtn.disabled = false;
    this.knowBtn.disabled = false;
    this.partialBtn.disabled = false;
    this.unknownBtn.disabled = false;
  }

  setupEventListeners(){
    this.cardElement.addEventListener('click', () => this.flipCard());
    this.prevBtn.addEventListener('click', () => this.previousCard());
    this.nextBtn.addEventListener('click', () => this.nextCard());
    this.knowBtn.addEventListener('click', () => this.markCard('known'));
    this.partialBtn.addEventListener('click', () => this.markCard('partial'));
    this.unknownBtn.addEventListener('click', () => this.markCard('unknown'));

    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setFilter(e.target.dataset.filter);
      });
    });

    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  flipCard(){
    this.isFlipped = !this.isFlipped;
    this.cardElement.classList.toggle('flipped', this.isFlipped);
  }

  // 2. LINEAR PREVIOUS BUTTON
  previousCard(){
    if (this.filteredCards.length === 0) return;
    
    // STRICTLY MATHEMATICAL PREVIOUS (Index - 1)
    this.currentIndex--;
    
    // Loop to end if at beginning
    if (this.currentIndex < 0) {
        this.currentIndex = this.filteredCards.length - 1;
    }
    this.updateDisplay();
  }

  // 3. LINEAR NEXT BUTTON
  nextCard(){
    if (this.filteredCards.length === 0) return;
    
    // STRICTLY MATHEMATICAL NEXT (Index + 1)
    this.currentIndex++;
    
    // Loop to start if at end
    if (this.currentIndex >= this.filteredCards.length) {
        this.currentIndex = 0;
    }

    this.updateDisplay();
  }

  markCard(status){
    if (this.filteredCards.length === 0) return;

    const currentCard = this.filteredCards[this.currentIndex];
    const originalIndex = this.cards.findIndex(card => card.id === currentCard.id);
    if (originalIndex !== -1) {
        this.cards[originalIndex].status = status;
    }

    this.showMarkingFeedback(status);

    setTimeout(() => {
      // 4. AFTER MARKING, MOVE TO NEXT CARD (LINEARLY)
      this.nextCard();
      this.updateStats();
    }, 400);
  }

  showMarkingFeedback(status){
    const colors = { known:'#28a745', partial:'#ffc107', unknown:'#dc3545' };
    this.cardElement.style.transform = 'scale(1.05)';
    this.cardElement.style.boxShadow = `0 0 20px ${colors[status]}`;
    setTimeout(() => { this.cardElement.style.transform=''; this.cardElement.style.boxShadow=''; }, 250);
  }

  setFilter(filter){
    this.currentFilter = filter;
    this.applyFilter();
    // Reset to start of the list when changing filter
    this.currentIndex = 0;
    this.filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
    this.updateDisplay();
  }

  applyFilter(){
    switch(this.currentFilter){
      case 'partial': this.filteredCards = this.cards.filter(c => c.status === 'partial'); break;
      case 'unknown': this.filteredCards = this.cards.filter(c => c.status === 'unknown'); break;
      default: this.filteredCards = [...this.cards];
    }
  }

  updateDisplay(){
    if (this.filteredCards.length === 0){
      this.cardContainer.style.display = 'none';
      this.noCardsMessage.style.display = 'block';
      this.cardCounter.textContent = 'Ni kartic za prikaz';
      this.prevBtn.disabled = true;
      this.nextBtn.disabled = true;
      return;
    }

    this.cardContainer.style.display = 'block';
    this.noCardsMessage.style.display = 'none';

    const currentCard = this.filteredCards[this.currentIndex];
    
    // CHANGED: Use 'front' and 'back' properties which were randomized in fetchCards
    this.cardFront.textContent = currentCard.front;
    this.cardBack.textContent  = currentCard.back;

    this.isFlipped = false;
    this.cardElement.classList.remove('flipped');

    this.cardCounter.textContent = `Kartica ${this.currentIndex + 1} od ${this.filteredCards.length}`;
    this.prevBtn.disabled = this.filteredCards.length <= 1;
    this.nextBtn.disabled = this.filteredCards.length <= 1;
  }

  updateStats(){
    const known   = this.cards.filter(c => c.status === 'known').length;
    const partial = this.cards.filter(c => c.status === 'partial').length;
    const unknown = this.cards.filter(c => c.status === 'unknown').length;
    const total   = this.cards.length;

    this.totalCardsSpan.textContent   = total;
    this.knownCardsSpan.textContent   = known;
    this.partialCardsSpan.textContent = partial;
    this.unknownCardsSpan.textContent = unknown;

    const successRate = total > 0 ? Math.round((known / total) * 100) : 0;
    this.successRateSpan.textContent = `${successRate}%`;

    const bar = this.progressBar;
    bar.textContent = `${successRate}%`;
    bar.style.width = `${successRate}%`;
    if (successRate >= 80){ bar.style.background = 'linear-gradient(90deg,#28a745,#20c997)'; }
    else if (successRate >= 60){ bar.style.background = 'linear-gradient(90deg,#ffc107,#fd7e14)'; }
    else { bar.style.background = 'linear-gradient(90deg,#dc3545,#e74c3c)'; }
  }

  handleKeyboard(e){
    switch(e.code){
      case 'ArrowLeft': e.preventDefault(); this.previousCard(); break;
      case 'ArrowRight': e.preventDefault(); this.nextCard(); break;
      case 'Space': e.preventDefault(); this.flipCard(); break;
      case 'Digit1': e.preventDefault(); this.markCard('known'); break;
      case 'Digit2': e.preventDefault(); this.markCard('partial'); break;
      case 'Digit3': e.preventDefault(); this.markCard('unknown'); break;
    }
  }
}

// 🚀 Inicializacija
buildDatasetSelect();

const reloadBtn = document.getElementById("reloadBtn");
reloadBtn.addEventListener("click", async () => {
  const ds = currentDataset();
  localStorage.setItem(SELECT_KEY, ds.id);
  setLoadingUI(true);
  try {
    const cards = await fetchCards(ds.url);
    window.app = new AnkiApp(cards);
  } catch (err){
    console.error(err);
    document.getElementById('cardFront').textContent = "Napaka pri nalaganju kartic 😢";
    document.getElementById('cardBack').textContent = "(preveri URL do JSON datoteke)";
  } finally {
    setLoadingUI(false);
  }
});

// Samodejno naloži ob vstopu, če obstaja prejšnja izbira
if (localStorage.getItem(SELECT_KEY)){
  reloadBtn.click();
}
