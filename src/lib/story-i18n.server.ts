// Riddle chapters (wall_story_chapters ids 1-4) in every non-Arabic app language. Server-only: answers must never reach the browser.
// Arabic stays in the DB. Wordplay riddles are rewritten per language so they still work after translation.
import { normalizeAnswer } from "./story-model";

export type RiddleText = { title: string; story: string; riddle: string; hint: string; answers: string[] };
export const RIDDLES_I18N: Record<string, RiddleText[]> = {
 "en": [
  {
   "title": "Dawn on the Wall",
   "story": "The sun rose while fog still covered the land. From atop the wall, the scout saw titan shadows walking toward the city. The commander left a message before vanishing: whoever understands it will know what we protect.",
   "riddle": "I protect people without moving, and titans strike me while I stand still. What am I?",
   "hint": "Look under the scout's feet in the picture.",
   "answers": [
    "wall",
    "the wall",
    "a wall"
   ]
  },
  {
   "title": "The Burned Forest",
   "story": "The squad entered the forest at night while the fire still burned. A giant hand reached out from behind the trees, and the captain shouted the password to gather the squad. No one heard it all, but a clue was carved on the trees.",
   "riddle": "The carving says: I'm born only at night, I shine but never burn, and lost travelers follow me home. What is the password?",
   "hint": "Look up at the sky above the moon.",
   "answers": [
    "star",
    "a star",
    "the star",
    "stars"
   ]
  },
  {
   "title": "Tunnel Under the Castle",
   "story": "Under the castle lies an old tunnel locked with chains. Words are carved on the iron door, and a golden light glows at the end of the tunnel. The guards say whoever reads them right will reach what is hidden.",
   "riddle": "The door reads: I sleep in the dark behind iron, I'm made of gold and jewels, and every thief dreams of me. What am I?",
   "hint": "It's the golden light at the end of the tunnel.",
   "answers": [
    "treasure",
    "the treasure",
    "a treasure"
   ]
  },
  {
   "title": "The Vault Door",
   "story": "The scout reached the great vault door, with gold everywhere around it. The door has no ordinary lock, only one question written on it, and whoever answers opens it.",
   "riddle": "I have teeth but never bite, and I open locked doors. What am I?",
   "hint": "The scout is holding it in the picture.",
   "answers": [
    "key",
    "a key",
    "the key"
   ]
  }
 ],
 "ru": [
  {
   "title": "Рассвет на стене",
   "story": "Взошло солнце, а туман всё ещё укрывал землю. Со стены разведчик увидел тени титанов, идущих к городу. Командир оставил послание перед тем, как исчезнуть: кто его поймёт, узнает, что мы защищаем.",
   "riddle": "Я защищаю людей, не двигаясь, а титаны бьют меня, пока я стою на месте. Кто я?",
   "hint": "Посмотри под ноги разведчику на картинке.",
   "answers": [
    "стена",
    "стену"
   ]
  },
  {
   "title": "Сожжённый лес",
   "story": "Отряд вошёл в лес ночью, когда огонь ещё горел. Из-за деревьев высунулась гигантская рука, и капитан выкрикнул пароль, чтобы собрать отряд. Никто не расслышал его целиком, но на деревьях вырезали подсказку.",
   "riddle": "Надпись гласит: я рождаюсь только ночью, сияю, но не горю, и заблудившиеся идут за мной домой. Какой пароль?",
   "hint": "Посмотри на небо над луной.",
   "answers": [
    "звезда",
    "звезду",
    "звёзды",
    "звезды"
   ]
  },
  {
   "title": "Туннель под замком",
   "story": "Под замком есть старый туннель, закованный цепями. На железной двери вырезаны слова, а в конце туннеля светится золотой свет. Стражи говорят: кто прочтёт их верно, доберётся до спрятанного.",
   "riddle": "На двери написано: я сплю во тьме за железом, я из золота и драгоценностей, и о мне мечтает каждый вор. Что я?",
   "hint": "Это золотой свет в конце туннеля.",
   "answers": [
    "сокровище",
    "клад",
    "сокровища"
   ]
  },
  {
   "title": "Дверь хранилища",
   "story": "Разведчик добрался до огромной двери хранилища, вокруг повсюду золото. На двери нет обычного замка — только один вопрос, и кто ответит, тот откроет её.",
   "riddle": "У меня есть зубы, но я не кусаюсь, и я открываю запертые двери. Что я?",
   "hint": "Разведчик держит это в руке на картинке.",
   "answers": [
    "ключ"
   ]
  }
 ],
 "es": [
  {
   "title": "Amanecer en el muro",
   "story": "Salió el sol y la niebla aún cubría la tierra. Desde lo alto del muro, el explorador vio sombras de titanes caminando hacia la ciudad. El comandante dejó un mensaje antes de desaparecer: quien lo entienda sabrá qué protegemos.",
   "riddle": "Protejo a la gente sin moverme, y los titanes me golpean mientras sigo en mi sitio. ¿Qué soy?",
   "hint": "Mira bajo los pies del explorador en la imagen.",
   "answers": [
    "muro",
    "el muro",
    "muralla",
    "la muralla"
   ]
  },
  {
   "title": "El bosque quemado",
   "story": "El escuadrón entró al bosque de noche con el fuego aún ardiendo. Una mano gigante salió de entre los árboles y el capitán gritó la contraseña para reunir al escuadrón. Nadie la oyó entera, pero dejaron una pista tallada en los árboles.",
   "riddle": "La talla dice: solo nazco de noche, brillo pero nunca quemo, y los viajeros perdidos me siguen a casa. ¿Cuál es la contraseña?",
   "hint": "Mira al cielo, encima de la luna.",
   "answers": [
    "estrella",
    "la estrella",
    "una estrella",
    "estrellas"
   ]
  },
  {
   "title": "Túnel bajo el castillo",
   "story": "Bajo el castillo hay un viejo túnel cerrado con cadenas. En la puerta de hierro hay palabras talladas y al final del túnel brilla una luz dorada. Los guardias dicen que quien las lea bien llegará a lo escondido.",
   "riddle": "La puerta dice: duermo en la oscuridad tras el hierro, estoy hecho de oro y joyas, y todo ladrón sueña conmigo. ¿Qué soy?",
   "hint": "Es la luz dorada al final del túnel.",
   "answers": [
    "tesoro",
    "el tesoro",
    "un tesoro"
   ]
  },
  {
   "title": "La puerta de la bóveda",
   "story": "El explorador llegó a la gran puerta de la bóveda, rodeada de oro. La puerta no tiene cerradura normal, solo una pregunta escrita, y quien la responda la abre.",
   "riddle": "Tengo dientes pero no muerdo, y abro puertas cerradas. ¿Qué soy?",
   "hint": "El explorador la sostiene en la imagen.",
   "answers": [
    "llave",
    "la llave",
    "una llave"
   ]
  }
 ],
 "pt": [
  {
   "title": "Amanhecer na muralha",
   "story": "O sol nasceu e a névoa ainda cobria a terra. Do alto da muralha, o batedor viu sombras de titãs caminhando para a cidade. O comandante deixou uma mensagem antes de sumir: quem a entender saberá o que protegemos.",
   "riddle": "Protejo as pessoas sem me mover, e os titãs me golpeiam enquanto fico parado. O que sou?",
   "hint": "Olhe sob os pés do batedor na imagem.",
   "answers": [
    "muralha",
    "a muralha",
    "muro",
    "o muro"
   ]
  },
  {
   "title": "A floresta queimada",
   "story": "O esquadrão entrou na floresta à noite com o fogo ainda aceso. Uma mão gigante surgiu atrás das árvores, e o capitão gritou a senha para reunir o esquadrão. Ninguém ouviu inteira, mas deixaram uma pista entalhada nas árvores.",
   "riddle": "O entalhe diz: só nasço à noite, brilho mas nunca queimo, e viajantes perdidos me seguem até em casa. Qual é a senha?",
   "hint": "Olhe para o céu acima da lua.",
   "answers": [
    "estrela",
    "a estrela",
    "uma estrela",
    "estrelas"
   ]
  },
  {
   "title": "Túnel sob o castelo",
   "story": "Sob o castelo há um velho túnel trancado com correntes. Na porta de ferro há palavras entalhadas, e uma luz dourada brilha no fim do túnel. Os guardas dizem que quem as ler certo chegará ao que está escondido.",
   "riddle": "A porta diz: durmo no escuro atrás do ferro, sou feito de ouro e joias, e todo ladrão sonha comigo. O que sou?",
   "hint": "É a luz dourada no fim do túnel.",
   "answers": [
    "tesouro",
    "o tesouro",
    "um tesouro"
   ]
  },
  {
   "title": "A porta do cofre",
   "story": "O batedor chegou à grande porta do cofre, com ouro por toda parte. A porta não tem fechadura comum, só uma pergunta escrita, e quem responder a abre.",
   "riddle": "Tenho dentes mas não mordo, e abro portas trancadas. O que sou?",
   "hint": "O batedor está segurando na imagem.",
   "answers": [
    "chave",
    "a chave",
    "uma chave"
   ]
  }
 ],
 "fr": [
  {
   "title": "Aube sur le mur",
   "story": "Le soleil s’est levé alors que le brouillard couvrait encore la terre. Du haut du mur, l’éclaireur a vu des ombres de titans marcher vers la ville. Le commandant a laissé un message avant de disparaître : qui le comprendra saura ce que nous protégeons.",
   "riddle": "Je protège les gens sans bouger, et les titans me frappent pendant que je reste immobile. Que suis-je ?",
   "hint": "Regarde sous les pieds de l’éclaireur sur l’image.",
   "answers": [
    "mur",
    "le mur",
    "muraille",
    "la muraille",
    "un mur"
   ]
  },
  {
   "title": "La forêt brûlée",
   "story": "L’escouade est entrée dans la forêt de nuit, le feu brûlant encore. Une main géante a surgi derrière les arbres, et le capitaine a crié le mot de passe pour rassembler l’escouade. Personne ne l’a entendu en entier, mais un indice a été gravé sur les arbres.",
   "riddle": "La gravure dit : je ne nais que la nuit, je brille sans jamais brûler, et les voyageurs perdus me suivent jusque chez eux. Quel est le mot de passe ?",
   "hint": "Regarde le ciel au-dessus de la lune.",
   "answers": [
    "étoile",
    "etoile",
    "l'étoile",
    "une étoile",
    "étoiles"
   ]
  },
  {
   "title": "Tunnel sous le château",
   "story": "Sous le château se trouve un vieux tunnel fermé par des chaînes. Des mots sont gravés sur la porte de fer, et une lumière dorée brille au bout du tunnel. Les gardes disent que celui qui les lira correctement atteindra ce qui est caché.",
   "riddle": "La porte dit : je dors dans le noir derrière le fer, je suis fait d’or et de joyaux, et tous les voleurs rêvent de moi. Que suis-je ?",
   "hint": "C’est la lumière dorée au bout du tunnel.",
   "answers": [
    "trésor",
    "tresor",
    "le trésor",
    "un trésor"
   ]
  },
  {
   "title": "La porte du coffre",
   "story": "L’éclaireur a atteint la grande porte du coffre, entourée d’or. La porte n’a pas de serrure ordinaire, seulement une question écrite dessus, et celui qui y répond l’ouvre.",
   "riddle": "J’ai des dents mais je ne mords jamais, et j’ouvre les portes fermées. Que suis-je ?",
   "hint": "L’éclaireur la tient dans sa main sur l’image.",
   "answers": [
    "clé",
    "cle",
    "clef",
    "la clé",
    "une clé"
   ]
  }
 ],
 "de": [
  {
   "title": "Morgengrauen auf der Mauer",
   "story": "Die Sonne ging auf, während Nebel noch das Land bedeckte. Von der Mauer aus sah der Späher Titanenschatten auf die Stadt zugehen. Der Kommandant hinterließ eine Nachricht, bevor er verschwand: Wer sie versteht, weiß, was wir beschützen.",
   "riddle": "Ich beschütze Menschen, ohne mich zu bewegen, und Titanen schlagen auf mich ein, während ich stillstehe. Was bin ich?",
   "hint": "Schau unter die Füße des Spähers im Bild.",
   "answers": [
    "mauer",
    "die mauer",
    "wall"
   ]
  },
  {
   "title": "Der verbrannte Wald",
   "story": "Der Trupp betrat nachts den Wald, während das Feuer noch brannte. Eine riesige Hand griff hinter den Bäumen hervor, und der Hauptmann rief das Passwort, um den Trupp zu sammeln. Niemand hörte es ganz, doch ein Hinweis wurde in die Bäume geritzt.",
   "riddle": "Die Inschrift sagt: Ich werde nur nachts geboren, ich leuchte, brenne aber nie, und Verirrte folgen mir nach Hause. Wie lautet das Passwort?",
   "hint": "Schau in den Himmel über dem Mond.",
   "answers": [
    "stern",
    "der stern",
    "ein stern",
    "sterne"
   ]
  },
  {
   "title": "Tunnel unter der Burg",
   "story": "Unter der Burg liegt ein alter, mit Ketten verschlossener Tunnel. In die Eisentür sind Worte geritzt, und am Ende des Tunnels leuchtet goldenes Licht. Die Wachen sagen: Wer sie richtig liest, erreicht das Verborgene.",
   "riddle": "Auf der Tür steht: Ich schlafe im Dunkeln hinter Eisen, bin aus Gold und Juwelen, und jeder Dieb träumt von mir. Was bin ich?",
   "hint": "Es ist das goldene Licht am Ende des Tunnels.",
   "answers": [
    "schatz",
    "der schatz",
    "ein schatz"
   ]
  },
  {
   "title": "Die Tresortür",
   "story": "Der Späher erreichte die große Tresortür, überall ringsum Gold. Die Tür hat kein gewöhnliches Schloss, nur eine Frage steht darauf, und wer sie beantwortet, öffnet sie.",
   "riddle": "Ich habe Zähne, beiße aber nie, und ich öffne verschlossene Türen. Was bin ich?",
   "hint": "Der Späher hält ihn im Bild in der Hand.",
   "answers": [
    "schlüssel",
    "schluessel",
    "schlussel",
    "der schlüssel",
    "ein schlüssel"
   ]
  }
 ],
 "tr": [
  {
   "title": "Surda Şafak",
   "story": "Güneş doğdu ama sis hâlâ toprağı örtüyordu. Surun tepesinden izci, şehre doğru yürüyen titan gölgeleri gördü. Komutan kaybolmadan önce bir mesaj bıraktı: Onu anlayan neyi koruduğumuzu bilecek.",
   "riddle": "İnsanları hiç kıpırdamadan korurum, ben yerimde dururken titanlar bana vurur. Ben neyim?",
   "hint": "Resimde izcinin ayaklarının altına bak.",
   "answers": [
    "sur",
    "duvar",
    "sur duvarı"
   ]
  },
  {
   "title": "Yanmış Orman",
   "story": "Ateş hâlâ yanarken birlik gece ormana girdi. Ağaçların arkasından dev bir el uzandı ve yüzbaşı birliği toplamak için parolayı bağırdı. Kimse tamamını duymadı ama ağaçlara bir ipucu kazındı.",
   "riddle": "Yazıt diyor ki: Yalnızca gece doğarım, parlarım ama asla yakmam, kaybolanlar beni izleyerek eve döner. Parola ne?",
   "hint": "Ayın üstündeki gökyüzüne bak.",
   "answers": [
    "yıldız",
    "yildiz",
    "yıldızlar"
   ]
  },
  {
   "title": "Kalenin Altındaki Tünel",
   "story": "Kalenin altında zincirlerle kilitli eski bir tünel var. Demir kapıya kelimeler kazınmış ve tünelin sonunda altın bir ışık parlıyor. Muhafızlar, onları doğru okuyanın saklı olana ulaşacağını söylüyor.",
   "riddle": "Kapıda yazıyor: Demirin ardında karanlıkta uyurum, altın ve mücevherdenim, her hırsız beni hayal eder. Ben neyim?",
   "hint": "Tünelin sonundaki altın ışık.",
   "answers": [
    "hazine",
    "define"
   ]
  },
  {
   "title": "Hazine Odasının Kapısı",
   "story": "İzci, etrafı altınla dolu büyük hazine kapısına ulaştı. Kapıda sıradan bir kilit yok, üzerinde yalnızca tek bir soru yazıyor; cevaplayan onu açar.",
   "riddle": "Dişlerim var ama ısırmam, kilitli kapıları açarım. Ben neyim?",
   "hint": "Resimde izci onu elinde tutuyor.",
   "answers": [
    "anahtar"
   ]
  }
 ],
 "id": [
  {
   "title": "Fajar di Tembok",
   "story": "Matahari terbit sementara kabut masih menutupi tanah. Dari atas tembok, sang pengintai melihat bayangan titan berjalan menuju kota. Komandan meninggalkan pesan sebelum menghilang: siapa yang memahaminya akan tahu apa yang kita lindungi.",
   "riddle": "Aku melindungi orang tanpa bergerak, dan para titan memukulku saat aku diam di tempat. Apakah aku?",
   "hint": "Lihat di bawah kaki pengintai di gambar.",
   "answers": [
    "tembok",
    "dinding",
    "benteng"
   ]
  },
  {
   "title": "Hutan yang Terbakar",
   "story": "Pasukan memasuki hutan di malam hari saat api masih menyala. Tangan raksasa muncul dari balik pepohonan, dan kapten meneriakkan kata sandi untuk mengumpulkan pasukan. Tak ada yang mendengarnya utuh, tapi sebuah petunjuk terukir di pohon.",
   "riddle": "Ukirannya berkata: aku hanya lahir di malam hari, aku bersinar tapi tak pernah membakar, dan pengembara yang tersesat mengikutiku pulang. Apa kata sandinya?",
   "hint": "Lihat langit di atas bulan.",
   "answers": [
    "bintang"
   ]
  },
  {
   "title": "Terowongan di Bawah Kastil",
   "story": "Di bawah kastil ada terowongan tua yang dikunci rantai. Ada kata-kata terukir di pintu besi, dan cahaya emas bersinar di ujung terowongan. Para penjaga berkata siapa yang membacanya dengan benar akan sampai pada yang tersembunyi.",
   "riddle": "Pintu itu bertuliskan: aku tidur dalam gelap di balik besi, aku terbuat dari emas dan permata, dan setiap pencuri memimpikanku. Apakah aku?",
   "hint": "Itu cahaya emas di ujung terowongan.",
   "answers": [
    "harta",
    "harta karun"
   ]
  },
  {
   "title": "Pintu Brankas",
   "story": "Pengintai tiba di pintu brankas besar, dengan emas di mana-mana. Pintu itu tak punya kunci biasa, hanya satu pertanyaan tertulis, dan siapa yang menjawab akan membukanya.",
   "riddle": "Aku punya gigi tapi tak pernah menggigit, dan aku membuka pintu yang terkunci. Apakah aku?",
   "hint": "Pengintai memegangnya di gambar.",
   "answers": [
    "kunci",
    "anak kunci"
   ]
  }
 ],
 "vi": [
  {
   "title": "Bình minh trên tường thành",
   "story": "Mặt trời mọc khi sương mù vẫn phủ kín mặt đất. Từ trên tường thành, người trinh sát thấy bóng titan đang tiến về thành phố. Chỉ huy để lại một lời nhắn trước khi biến mất: ai hiểu được sẽ biết ta đang bảo vệ điều gì.",
   "riddle": "Tôi bảo vệ mọi người mà không hề di chuyển, và titan đánh vào tôi khi tôi đứng yên. Tôi là gì?",
   "hint": "Nhìn dưới chân người trinh sát trong hình.",
   "answers": [
    "tường",
    "tường thành",
    "bức tường",
    "tuong",
    "tuong thanh"
   ]
  },
  {
   "title": "Khu rừng cháy",
   "story": "Đội vào rừng lúc đêm khi lửa vẫn còn cháy. Một bàn tay khổng lồ thò ra từ sau hàng cây, và đội trưởng hét mật khẩu để tập hợp đội. Không ai nghe trọn, nhưng có một gợi ý được khắc trên cây.",
   "riddle": "Dòng khắc viết: tôi chỉ sinh ra vào ban đêm, tôi tỏa sáng nhưng không bao giờ thiêu đốt, và người lạc đường theo tôi về nhà. Mật khẩu là gì?",
   "hint": "Nhìn lên bầu trời phía trên mặt trăng.",
   "answers": [
    "ngôi sao",
    "sao",
    "ngoi sao"
   ]
  },
  {
   "title": "Đường hầm dưới lâu đài",
   "story": "Dưới lâu đài có một đường hầm cũ bị khóa bằng xích. Trên cánh cửa sắt có khắc chữ, và ánh sáng vàng tỏa ra ở cuối đường hầm. Lính gác nói ai đọc đúng sẽ đến được nơi cất giấu.",
   "riddle": "Cánh cửa viết: tôi ngủ trong bóng tối sau lớp sắt, tôi làm từ vàng và châu báu, và mọi tên trộm đều mơ về tôi. Tôi là gì?",
   "hint": "Đó là ánh sáng vàng ở cuối đường hầm.",
   "answers": [
    "kho báu",
    "kho bau",
    "châu báu"
   ]
  },
  {
   "title": "Cửa kho bạc",
   "story": "Người trinh sát đến cánh cửa kho bạc lớn, xung quanh toàn vàng. Cánh cửa không có ổ khóa bình thường, chỉ có một câu hỏi, ai trả lời được sẽ mở nó.",
   "riddle": "Tôi có răng nhưng không bao giờ cắn, và tôi mở những cánh cửa bị khóa. Tôi là gì?",
   "hint": "Người trinh sát đang cầm nó trong hình.",
   "answers": [
    "chìa khóa",
    "chìa khoá",
    "chia khoa",
    "chìa"
   ]
  }
 ],
 "hi": [
  {
   "title": "दीवार पर भोर",
   "story": "सूरज निकला, पर धुंध अभी भी ज़मीन को ढके थी। दीवार के ऊपर से स्काउट ने टाइटनों की परछाइयाँ शहर की ओर बढ़ती देखीं। कमांडर गायब होने से पहले एक संदेश छोड़ गया: जो इसे समझेगा, वह जानेगा कि हम किसकी रक्षा करते हैं।",
   "riddle": "मैं बिना हिले लोगों की रक्षा करती हूँ, और टाइटन मुझ पर वार करते हैं जबकि मैं अपनी जगह खड़ी रहती हूँ। मैं कौन हूँ?",
   "hint": "तस्वीर में स्काउट के पैरों के नीचे देखो।",
   "answers": [
    "दीवार",
    "दिवार",
    "wall"
   ]
  },
  {
   "title": "जला हुआ जंगल",
   "story": "आग अभी जल ही रही थी कि दस्ता रात में जंगल में घुसा। पेड़ों के पीछे से एक विशाल हाथ निकला, और कप्तान ने दस्ते को इकट्ठा करने के लिए पासवर्ड चिल्लाया। किसी ने पूरा नहीं सुना, पर पेड़ों पर एक सुराग खुदा था।",
   "riddle": "खुदाई में लिखा है: मैं सिर्फ़ रात में जन्मता हूँ, चमकता हूँ पर कभी जलाता नहीं, और भटके मुसाफ़िर मेरे पीछे घर लौटते हैं। पासवर्ड क्या है?",
   "hint": "चाँद के ऊपर आसमान में देखो।",
   "answers": [
    "तारा",
    "सितारा",
    "तारे",
    "star"
   ]
  },
  {
   "title": "किले के नीचे सुरंग",
   "story": "किले के नीचे ज़ंजीरों से बंद एक पुरानी सुरंग है। लोहे के दरवाज़े पर शब्द खुदे हैं, और सुरंग के आख़िर में सुनहरी रोशनी चमकती है। पहरेदार कहते हैं जो इन्हें सही पढ़ेगा, वह छिपी चीज़ तक पहुँचेगा।",
   "riddle": "दरवाज़े पर लिखा है: मैं लोहे के पीछे अँधेरे में सोता हूँ, सोने और जवाहरात से बना हूँ, और हर चोर मेरे सपने देखता है। मैं क्या हूँ?",
   "hint": "यह सुरंग के आख़िर की सुनहरी रोशनी है।",
   "answers": [
    "ख़ज़ाना",
    "खज़ाना",
    "खजाना",
    "treasure"
   ]
  },
  {
   "title": "तिजोरी का दरवाज़ा",
   "story": "स्काउट तिजोरी के बड़े दरवाज़े तक पहुँचा, चारों ओर सोना ही सोना। दरवाज़े पर कोई आम ताला नहीं, बस एक सवाल लिखा है, और जो जवाब देगा वही इसे खोलेगा।",
   "riddle": "मेरे दाँत हैं पर मैं काटती नहीं, और मैं बंद दरवाज़े खोलती हूँ। मैं क्या हूँ?",
   "hint": "तस्वीर में स्काउट इसे हाथ में पकड़े है।",
   "answers": [
    "चाबी",
    "चाभी",
    "कुंजी",
    "key"
   ]
  }
 ],
 "zh": [
  {
   "title": "城墙上的黎明",
   "story": "太阳升起，雾气仍笼罩着大地。侦察兵站在城墙上，看到巨人的影子正走向城市。指挥官消失前留下一条讯息：读懂它的人，就会知道我们在守护什么。",
   "riddle": "我一动不动地保护着人们，巨人攻击我时我仍屹立原地。我是什么？",
   "hint": "看看图中侦察兵的脚下。",
   "answers": [
    "墙",
    "城墙",
    "围墙",
    "墙壁"
   ]
  },
  {
   "title": "焚烧的森林",
   "story": "小队在夜里进入森林，火还在燃烧。一只巨手从树后伸出，队长喊出口令召集小队。没人听全，但树上刻下了一条线索。",
   "riddle": "刻文写着：我只在夜里出生，我发光却从不灼烧，迷路的旅人跟着我回家。口令是什么？",
   "hint": "抬头看看月亮上方的天空。",
   "answers": [
    "星星",
    "星",
    "星辰"
   ]
  },
  {
   "title": "城堡下的隧道",
   "story": "城堡下有一条被铁链锁住的古老隧道。铁门上刻着字，隧道尽头闪着金光。守卫说，读对的人就能找到藏起来的东西。",
   "riddle": "门上写着：我睡在铁门后的黑暗里，由黄金和珠宝组成，每个小偷都梦想得到我。我是什么？",
   "hint": "就是隧道尽头的金光。",
   "answers": [
    "宝藏",
    "财宝",
    "宝物"
   ]
  },
  {
   "title": "金库大门",
   "story": "侦察兵来到巨大的金库门前，四周堆满黄金。这扇门没有普通的锁，只写着一个问题，答对的人就能打开它。",
   "riddle": "我有牙齿却从不咬人，我能打开锁住的门。我是什么？",
   "hint": "图中侦察兵正握着它。",
   "answers": [
    "钥匙",
    "锁匙",
    "鑰匙"
   ]
  }
 ],
 "ko": [
  {
   "title": "성벽 위의 새벽",
   "story": "해가 떴지만 안개는 아직 땅을 덮고 있었다. 성벽 위에서 정찰병은 도시로 걸어오는 거인들의 그림자를 보았다. 사령관은 사라지기 전에 메시지를 남겼다. 이걸 이해하는 사람은 우리가 무엇을 지키는지 알게 될 것이다.",
   "riddle": "나는 움직이지 않고 사람들을 지키고, 내가 제자리에 서 있는 동안 거인들이 나를 때린다. 나는 무엇일까?",
   "hint": "그림 속 정찰병의 발밑을 봐.",
   "answers": [
    "벽",
    "성벽",
    "장벽"
   ]
  },
  {
   "title": "불탄 숲",
   "story": "불이 아직 타오르는 밤, 분대는 숲으로 들어갔다. 나무 뒤에서 거대한 손이 뻗어 나왔고, 대장은 분대를 모으려고 암호를 외쳤다. 아무도 끝까지 듣지 못했지만, 나무에 단서가 새겨져 있었다.",
   "riddle": "새겨진 글: 나는 밤에만 태어나고, 빛나지만 절대 태우지 않으며, 길 잃은 나그네는 나를 따라 집으로 돌아간다. 암호는 무엇일까?",
   "hint": "달 위의 하늘을 올려다봐.",
   "answers": [
    "별",
    "별빛"
   ]
  },
  {
   "title": "성 아래의 터널",
   "story": "성 아래에는 쇠사슬로 잠긴 오래된 터널이 있다. 철문에는 글이 새겨져 있고, 터널 끝에서 금빛이 빛난다. 경비병들은 그걸 제대로 읽는 사람이 숨겨진 것에 닿는다고 말한다.",
   "riddle": "문에 적힌 글: 나는 철문 뒤 어둠 속에서 잠들고, 금과 보석으로 이루어져 있으며, 모든 도둑이 나를 꿈꾼다. 나는 무엇일까?",
   "hint": "터널 끝의 금빛이야.",
   "answers": [
    "보물",
    "보화"
   ]
  },
  {
   "title": "금고의 문",
   "story": "정찰병은 사방이 금으로 가득한 거대한 금고 문에 도착했다. 그 문에는 평범한 자물쇠가 없고, 질문 하나만 적혀 있다. 답하는 자가 문을 연다.",
   "riddle": "나는 이빨이 있지만 절대 물지 않고, 잠긴 문을 연다. 나는 무엇일까?",
   "hint": "그림 속 정찰병이 손에 들고 있어.",
   "answers": [
    "열쇠",
    "키"
   ]
  }
 ],
 "ja": [
  {
   "title": "壁の上の夜明け",
   "story": "日が昇っても、霧はまだ大地を覆っていた。壁の上から、偵察兵は街へ向かう巨人の影を見た。司令官は消える前にメッセージを残した。これを理解した者は、我々が何を守っているかを知るだろう。",
   "riddle": "私は動かずに人々を守り、立ち尽くす私を巨人たちが殴りつける。私は何？",
   "hint": "絵の中の偵察兵の足元を見て。",
   "answers": [
    "壁",
    "かべ",
    "カベ",
    "城壁"
   ]
  },
  {
   "title": "焼けた森",
   "story": "火がまだ燃える夜、分隊は森に入った。木々の陰から巨大な手が伸び、隊長は分隊を集めるため合言葉を叫んだ。誰も最後まで聞き取れなかったが、木に手がかりが刻まれていた。",
   "riddle": "刻まれた言葉：私は夜にだけ生まれ、輝くけれど決して焼かず、迷った旅人は私について家へ帰る。合言葉は何？",
   "hint": "月の上の空を見上げて。",
   "answers": [
    "星",
    "ほし",
    "ホシ"
   ]
  },
  {
   "title": "城の下のトンネル",
   "story": "城の下には鎖で閉ざされた古いトンネルがある。鉄の扉には言葉が刻まれ、トンネルの奥で金色の光が輝いている。衛兵たちは、正しく読んだ者が隠されたものにたどり着くと言う。",
   "riddle": "扉にはこうある：私は鉄の向こうの暗闇で眠り、金と宝石でできていて、すべての泥棒が私を夢見る。私は何？",
   "hint": "トンネルの奥の金色の光だよ。",
   "answers": [
    "宝",
    "たから",
    "宝物",
    "たからもの",
    "財宝"
   ]
  },
  {
   "title": "金庫の扉",
   "story": "偵察兵は、あたり一面に金が積まれた巨大な金庫の扉にたどり着いた。扉には普通の錠はなく、問いがひとつ書かれているだけ。答えた者が扉を開ける。",
   "riddle": "私には歯があるけれど決して噛まず、閉ざされた扉を開ける。私は何？",
   "hint": "絵の中の偵察兵が手に持っているよ。",
   "answers": [
    "鍵",
    "かぎ",
    "カギ"
   ]
  }
 ],
 "uk": [
  {
   "title": "Світанок на стіні",
   "story": "Зійшло сонце, а туман ще вкривав землю. Зі стіни розвідник побачив тіні титанів, що йшли до міста. Командир залишив послання, перш ніж зникнути: хто його зрозуміє, той дізнається, що ми захищаємо.",
   "riddle": "Я захищаю людей, не рухаючись, а титани б'ють мене, поки я стою на місці. Хто я?",
   "hint": "Подивись під ноги розвідникові на картинці.",
   "answers": [
    "стіна",
    "стіну",
    "мур"
   ]
  },
  {
   "title": "Спалений ліс",
   "story": "Загін увійшов до лісу вночі, коли вогонь ще палав. З-за дерев висунулася велетенська рука, і капітан вигукнув пароль, щоб зібрати загін. Ніхто не почув його повністю, але на деревах вирізали підказку.",
   "riddle": "Напис каже: я народжуюся лише вночі, сяю, але ніколи не палю, і заблукалі йдуть за мною додому. Який пароль?",
   "hint": "Подивись на небо над місяцем.",
   "answers": [
    "зірка",
    "зірку",
    "зірки"
   ]
  },
  {
   "title": "Тунель під замком",
   "story": "Під замком є старий тунель, замкнений ланцюгами. На залізних дверях вирізані слова, а в кінці тунелю сяє золоте світло. Вартові кажуть: хто прочитає їх правильно, дістанеться до схованого.",
   "riddle": "На дверях написано: я сплю в темряві за залізом, я з золота й коштовностей, і про мене мріє кожен злодій. Що я?",
   "hint": "Це золоте світло в кінці тунелю.",
   "answers": [
    "скарб",
    "скарби"
   ]
  },
  {
   "title": "Двері сховища",
   "story": "Розвідник дістався величезних дверей сховища, навколо скрізь золото. На дверях немає звичайного замка, лише одне запитання, і хто відповість, той їх відчинить.",
   "riddle": "Я маю зуби, але не кусаю, і відчиняю замкнені двері. Що я?",
   "hint": "Розвідник тримає це в руці на картинці.",
   "answers": [
    "ключ"
   ]
  }
 ],
 "fa": [
  {
   "title": "سپیده‌دم روی دیوار",
   "story": "خورشید طلوع کرد و مه هنوز زمین را پوشانده بود. دیده‌بان از بالای دیوار سایه غول‌هایی را دید که به سمت شهر می‌آمدند. فرمانده پیش از ناپدید شدن پیامی گذاشت: هر کس آن را بفهمد، می‌داند ما از چه محافظت می‌کنیم.",
   "riddle": "بی‌آنکه تکان بخورم از مردم محافظت می‌کنم و غول‌ها در حالی که سر جایم ایستاده‌ام به من ضربه می‌زنند. من چیستم؟",
   "hint": "در تصویر زیر پای دیده‌بان را نگاه کن.",
   "answers": [
    "دیوار",
    "حصار",
    "باره"
   ]
  },
  {
   "title": "جنگل سوخته",
   "story": "گروه شب هنگام وارد جنگل شد، در حالی که آتش هنوز می‌سوخت. دستی غول‌آسا از پشت درختان بیرون آمد و فرمانده رمز را فریاد زد تا گروه جمع شود. کسی آن را کامل نشنید، اما سرنخی روی درختان کنده شده بود.",
   "riddle": "نوشته می‌گوید: فقط شب به دنیا می‌آیم، می‌درخشم اما هرگز نمی‌سوزانم و مسافران گمشده با دنبال کردن من به خانه برمی‌گردند. رمز چیست؟",
   "hint": "به آسمانِ بالای ماه نگاه کن.",
   "answers": [
    "ستاره",
    "ستارگان",
    "اختر"
   ]
  },
  {
   "title": "تونل زیر قلعه",
   "story": "زیر قلعه تونلی قدیمی است که با زنجیر قفل شده. روی در آهنی کلماتی کنده شده و نوری طلایی در انتهای تونل می‌درخشد. نگهبانان می‌گویند هر کس آن را درست بخواند به آنچه پنهان است می‌رسد.",
   "riddle": "روی در نوشته: پشت آهن در تاریکی می‌خوابم، از طلا و جواهرم و هر دزدی خواب مرا می‌بیند. من چیستم؟",
   "hint": "همان نور طلایی انتهای تونل است.",
   "answers": [
    "گنج",
    "گنجینه"
   ]
  },
  {
   "title": "در خزانه",
   "story": "دیده‌بان به در بزرگ خزانه رسید که دورتادورش پر از طلا بود. این در قفل معمولی ندارد، فقط یک سؤال رویش نوشته شده و هر کس جواب دهد آن را باز می‌کند.",
   "riddle": "دندان دارم اما هرگز گاز نمی‌گیرم و درهای قفل‌شده را باز می‌کنم. من چیستم؟",
   "hint": "دیده‌بان در تصویر آن را در دست دارد.",
   "answers": [
    "کلید"
   ]
  }
 ]
};

/** Localized chapter text, or null for Arabic / unknown languages. */
export function riddleText(lang: string, chapter: number): RiddleText | null {
  return RIDDLES_I18N[lang]?.[chapter - 1] ?? null;
}

const norm = (t: string) => normalizeAnswer(t.normalize("NFC"));
/** True when the guess matches the chapter's answer in any language. */
export function matchesAnyLanguage(chapter: number, guess: string): boolean {
  const g = norm(guess);
  if (!g) return false;
  return Object.values(RIDDLES_I18N).some((list) => list[chapter - 1]?.answers.some((a) => norm(a) === g));
}
