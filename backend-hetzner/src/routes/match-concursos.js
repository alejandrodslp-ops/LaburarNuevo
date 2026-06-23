const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAIS_ISO = {
  "uruguay":"UY","argentina":"AR","chile":"CL","colombia":"CO",
  "peru":"PE","perú":"PE","brasil":"BR","brazil":"BR",
  "paraguay":"PY","bolivia":"BO","ecuador":"EC","venezuela":"VE",
  "mexico":"MX","méxico":"MX","cuba":"CU",
  "costa rica":"CR","panama":"PA","panamá":"PA",
  "guatemala":"GT","el salvador":"SV","honduras":"HN","nicaragua":"NI",
  "republica dominicana":"DO","república dominicana":"DO",
  "espana":"ES","españa":"ES","spain":"ES","portugal":"PT",
  "italia":"IT","italy":"IT","francia":"FR","france":"FR",
  "alemania":"DE","germany":"DE","reino unido":"GB","united kingdom":"GB","uk":"GB",
  "estados unidos":"US","united states":"US","usa":"US",
  "canadá":"CA","canada":"CA","australia":"AU",
  "suecia":"SE","sweden":"SE","noruega":"NO","norway":"NO",
  "japon":"JP","japón":"JP","japan":"JP","india":"IN",
};

const PAIS_LANG = {
  DE:"de", AT:"de", CH:"de", FR:"fr", BE:"fr", IT:"it",
  PT:"pt", BR:"pt", GB:"en", US:"en", CA:"en", AU:"en",
  SE:"en", NO:"en", IN:"en",
};

const PAIS_LANGS_EXTRA = { CH: ["fr","it"], BE: ["de"] };

const TR = {
  "Ninera":{ pt:"Babá",en:"Nanny",de:"Kindermädchen",fr:"Nounou",it:"Babysitter" },
  "Cuidador/a de ancianos":{ pt:"Cuidador/a de idosos",en:"Elderly caregiver",de:"Altenpfleger/in",fr:"Aide aux personnes âgées",it:"Badante" },
  "Cuidador/a de discapacitados":{ pt:"Cuidador/a de deficientes",en:"Disability caregiver",de:"Behindertenpfleger/in",fr:"Aide aux personnes handicapées",it:"Assistente disabili" },
  "Auxiliar de limpieza":{ pt:"Auxiliar de limpeza",en:"Cleaning assistant",de:"Reinigungskraft",fr:"Agent de nettoyage",it:"Addetto alle pulizie" },
  "Auxiliar de limpieza empresarial":{ pt:"Auxiliar de limpeza comercial",en:"Commercial cleaning assistant",de:"Gewerbliche Reinigungskraft",fr:"Agent de nettoyage commercial",it:"Addetto pulizie commerciali" },
  "Plomero/a":{ pt:"Encanador/a",en:"Plumber",de:"Klempner/in",fr:"Plombier/ère",it:"Idraulico/a" },
  "Gasista":{ pt:"Gasista",en:"Gas technician",de:"Gastechniker/in",fr:"Gazier/ère",it:"Tecnico/a del gas" },
  "Electricista":{ pt:"Eletricista",en:"Electrician",de:"Elektriker/in",fr:"Électricien/ne",it:"Elettricista" },
  "Pintor/a":{ pt:"Pintor/a",en:"Painter",de:"Maler/in",fr:"Peintre",it:"Pittore/Pittrice" },
  "Carpintero/a":{ pt:"Carpinteiro/a",en:"Carpenter",de:"Schreiner/in",fr:"Charpentier/ère",it:"Falegname" },
  "Albanil":{ pt:"Pedreiro/a",en:"Mason",de:"Maurer/in",fr:"Maçon/ne",it:"Muratore/Muratrice" },
  "Albañil":{ pt:"Pedreiro/a",en:"Mason",de:"Maurer/in",fr:"Maçon/ne",it:"Muratore/a" },
  "Peon de albanileria":{ pt:"Servente de obras",en:"Construction helper",de:"Bauhelfer/in",fr:"Manœuvre bâtiment",it:"Manovale edile" },
  "Herrero/a":{ pt:"Ferreiro/a",en:"Blacksmith",de:"Schmied/in",fr:"Forgeron/ne",it:"Fabbro/a" },
  "Soldador/a":{ pt:"Soldador/a",en:"Welder",de:"Schweißer/in",fr:"Soudeur/se",it:"Saldatore/trice" },
  "Mecanico/a":{ pt:"Mecânico/a",en:"Mechanic",de:"Mechaniker/in",fr:"Mécanicien/ne",it:"Meccanico/a" },
  "Jardinero/a":{ pt:"Jardineiro/a",en:"Gardener",de:"Gärtner/in",fr:"Jardinier/ère",it:"Giardiniere/a" },
  "Cortador/a de cesped":{ pt:"Cortador/a de grama",en:"Lawn mower",de:"Rasenmäher/in",fr:"Tondeuse de pelouse",it:"Tagliaerba" },
  "Fumigador/a":{ pt:"Fumigador/a",en:"Fumigator",de:"Kammerjäger/in",fr:"Fumigateur/trice",it:"Disinfestatore/trice" },
  "Cocinero/a":{ pt:"Cozinheiro/a",en:"Cook",de:"Koch/Köchin",fr:"Cuisinier/ère",it:"Cuoco/a" },
  "Repostero/a":{ pt:"Confeiteiro/a",en:"Pastry chef",de:"Konditor/in",fr:"Pâtissier/ère",it:"Pasticciere/a" },
  "Mozo/a":{ pt:"Garçom/Garçonete",en:"Waiter/Waitress",de:"Kellner/in",fr:"Serveur/Serveuse",it:"Cameriere/a" },
  "Barman":{ pt:"Barman",en:"Bartender",de:"Barkeeper/in",fr:"Barman/Barmaid",it:"Barista" },
  "Reponedor/a":{ pt:"Repositor/a",en:"Stock clerk",de:"Regalauffüller/in",fr:"Réassortisseur/se",it:"Addetto/a scaffali" },
  "Chofer particular":{ pt:"Motorista particular",en:"Private driver",de:"Privatfahrer/in",fr:"Chauffeur privé",it:"Autista privato/a" },
  "Remisero/a":{ pt:"Motorista de aplicativo",en:"Rideshare driver",de:"Fahrdienstfahrer/in",fr:"Chauffeur VTC",it:"Autista NCC" },
  "Camionero/a":{ pt:"Caminhoneiro/a",en:"Truck driver",de:"LKW-Fahrer/in",fr:"Camionneur/se",it:"Camionista" },
  "Delivery":{ pt:"Entregador/a",en:"Delivery person",de:"Lieferfahrer/in",fr:"Livreur/se",it:"Fattorino/a" },
  "Portero/a":{ pt:"Porteiro/a",en:"Doorman/woman",de:"Pförtner/in",fr:"Portier/ère",it:"Portiere/a" },
  "Mucama":{ pt:"Governanta",en:"Housemaid",de:"Hausmädchen",fr:"Femme de chambre",it:"Domestica" },
  "Sereno/a":{ pt:"Vigilante noturno/a",en:"Night watchman",de:"Nachtwächter/in",fr:"Gardien/ne de nuit",it:"Guardiano/a notturno/a" },
  "Guardia de seguridad":{ pt:"Guarda de segurança",en:"Security guard",de:"Sicherheitskraft",fr:"Agent de sécurité",it:"Guardia di sicurezza" },
  "Custodia personal":{ pt:"Segurança pessoal",en:"Bodyguard",de:"Leibwächter/in",fr:"Garde du corps",it:"Guardia del corpo" },
  "Costurero/a":{ pt:"Costureiro/a",en:"Seamstress",de:"Näher/in",fr:"Couturier/ère",it:"Sarto/a" },
  "Sastre":{ pt:"Alfaiate",en:"Tailor",de:"Schneider/in",fr:"Tailleur",it:"Sarto" },
  "Zapatero/a":{ pt:"Sapateiro/a",en:"Cobbler",de:"Schuhmacher/in",fr:"Cordonnier/ère",it:"Calzolaio/a" },
  "Peluquero/a":{ pt:"Cabeleireiro/a",en:"Hairdresser",de:"Friseur/in",fr:"Coiffeur/se",it:"Parrucchiere/a" },
  "Esteticista":{ pt:"Esteticista",en:"Aesthetician",de:"Kosmetiker/in",fr:"Esthéticien/ne",it:"Estetista" },
  "Cuidado de animales":{ pt:"Cuidador/a de animais",en:"Pet caretaker",de:"Tierpfleger/in",fr:"Soigneur/se d'animaux",it:"Addetto/a cura animali" },
  "Paseador/a de perros":{ pt:"Passeador/a de cães",en:"Dog walker",de:"Hundesitter",fr:"Promeneur/se de chiens",it:"Dog sitter" },
  "Tractorista":{ pt:"Tratorista",en:"Tractor operator",de:"Traktorfahrer/in",fr:"Tractoriste",it:"Trattorista" },
  "Peon rural":{ pt:"Peão rural",en:"Farm laborer",de:"Landarbeiter/in",fr:"Ouvrier/ère agricole",it:"Bracciante agricolo/a" },
  "Alambrador":{ pt:"Aramador",en:"Fence installer",de:"Zaunbauer/in",fr:"Poseur/se de clôture",it:"Recinzionista" },
  "Domador":{ pt:"Domador",en:"Horse trainer",de:"Pferdezähmer/in",fr:"Dresseur/se",it:"Domatore/trice" },
  "Tropero":{ pt:"Tropeiro",en:"Cattle drover",de:"Viehtreiber/in",fr:"Bouvier",it:"Mandriano" },
  "Esquilador":{ pt:"Tosador",en:"Shearer",de:"Schafscherer/in",fr:"Tondeur/se",it:"Tosatore" },
  "Mandados":{ pt:"Recados",en:"Errands",de:"Botendienste",fr:"Courses/Commissions",it:"Commissioni" },
  "Mudanzas":{ pt:"Mudanças",en:"Moving services",de:"Umzugshelfer/in",fr:"Déménagement",it:"Traslochi" },
  "Planchado":{ pt:"Passadoria",en:"Ironing",de:"Bügeln",fr:"Repassage",it:"Stiratura" },
  "Medico/a":{ pt:"Médico/a",en:"Doctor",de:"Arzt/Ärztin",fr:"Médecin",it:"Medico/a" },
  "Enfermero/a":{ pt:"Enfermeiro/a",en:"Nurse",de:"Krankenpfleger/in",fr:"Infirmier/ère",it:"Infermiere/a" },
  "Auxiliar de enfermeria":{ pt:"Auxiliar de enfermagem",en:"Nursing assistant",de:"Pflegehelfer/in",fr:"Aide-soignant/e",it:"Operatore socio-sanitario" },
  "Farmaceutico/a":{ pt:"Farmacêutico/a",en:"Pharmacist",de:"Apotheker/in",fr:"Pharmacien/ne",it:"Farmacista" },
  "Odontologo/a":{ pt:"Odontólogo/a",en:"Dentist",de:"Zahnarzt/Zahnärztin",fr:"Dentiste",it:"Odontoiatra" },
  "Nutricionista":{ pt:"Nutricionista",en:"Nutritionist",de:"Ernährungsberater/in",fr:"Nutritionniste",it:"Nutrizionista" },
  "Fisioterapeuta":{ pt:"Fisioterapeuta",en:"Physiotherapist",de:"Physiotherapeut/in",fr:"Kinésithérapeute",it:"Fisioterapista" },
  "Psicologo/a":{ pt:"Psicólogo/a",en:"Psychologist",de:"Psychologe/Psychologin",fr:"Psychologue",it:"Psicologo/a" },
  "Abogado/a":{ pt:"Advogado/a",en:"Lawyer",de:"Rechtsanwalt/Rechtsanwältin",fr:"Avocat/e",it:"Avvocato/essa" },
  "Escribano/a":{ pt:"Tabelião/ã",en:"Notary",de:"Notar/in",fr:"Notaire",it:"Notaio/a" },
  "Contador/a":{ pt:"Contador/a",en:"Accountant",de:"Buchhalter/in",fr:"Comptable",it:"Commercialista" },
  "Economista":{ pt:"Economista",en:"Economist",de:"Ökonom/in",fr:"Économiste",it:"Economista" },
  "Administrador/a":{ pt:"Administrador/a",en:"Administrator",de:"Verwalter/in",fr:"Administrateur/trice",it:"Amministratore/trice" },
  "Auxiliar administrativo":{ pt:"Auxiliar administrativo",en:"Administrative assistant",de:"Verwaltungsassistent/in",fr:"Assistant/e administratif/ve",it:"Assistente amministrativo" },
  "Laboratorista":{ pt:"Laboratorista",en:"Lab technician",de:"Labortechniker/in",fr:"Technicien/ne de laboratoire",it:"Tecnico di laboratorio" },
  "Auditor/a":{ pt:"Auditor/a",en:"Auditor",de:"Wirtschaftsprüfer/in",fr:"Auditeur/trice",it:"Revisore dei conti" },
  "Ingeniero/a":{ pt:"Engenheiro/a",en:"Engineer",de:"Ingenieur/in",fr:"Ingénieur/e",it:"Ingegnere" },
  "Arquitecto/a":{ pt:"Arquiteto/a",en:"Architect",de:"Architekt/in",fr:"Architecte",it:"Architetto/a" },
  "Disenador/a":{ pt:"Designer",en:"Designer",de:"Designer/in",fr:"Designer",it:"Designer" },
  "Programador/a":{ pt:"Programador/a",en:"Programmer",de:"Programmierer/in",fr:"Programmeur/se",it:"Programmatore/trice" },
  "Desarrollador/a Web":{ pt:"Desenvolvedor/a Web",en:"Web Developer",de:"Webentwickler/in",fr:"Développeur/se Web",it:"Sviluppatore/trice Web" },
  "Data Analyst":{ pt:"Analista de Dados",en:"Data Analyst",de:"Datenanalyst/in",fr:"Analyste de données",it:"Analista dati" },
  "DevOps":{ pt:"DevOps",en:"DevOps",de:"DevOps",fr:"DevOps",it:"DevOps" },
  "Docente primaria":{ pt:"Professor/a primário/a",en:"Primary school teacher",de:"Grundschullehrer/in",fr:"Enseignant/e primaire",it:"Insegnante elementare" },
  "Docente secundaria":{ pt:"Professor/a secundário/a",en:"Secondary school teacher",de:"Sekundarschullehrer/in",fr:"Enseignant/e secondaire",it:"Insegnante secondaria" },
  "Profesor/a universitario":{ pt:"Professor/a universitário/a",en:"University professor",de:"Universitätsprofessor/in",fr:"Professeur/e universitaire",it:"Professore/ssa univ." },
  "Educador/a especial":{ pt:"Educador/a especial",en:"Special education teacher",de:"Sonderpädagoge/in",fr:"Éducateur/trice spécialisé/e",it:"Educatore/trice speciale" },
  "Periodista":{ pt:"Jornalista",en:"Journalist",de:"Journalist/in",fr:"Journaliste",it:"Giornalista" },
  "Comunicador/a":{ pt:"Comunicador/a",en:"Communications professional",de:"Kommunikationsfachmann/-frau",fr:"Communicant/e",it:"Comunicatore/trice" },
  "Marketing Digital":{ pt:"Marketing Digital",en:"Digital Marketing",de:"Digitales Marketing",fr:"Marketing Digital",it:"Marketing Digitale" },
  "Relacionista Publico":{ pt:"Relações Públicas",en:"Public Relations",de:"PR-Fachmann/-frau",fr:"Relations Publiques",it:"Relazioni Pubbliche" },
  "Veterinario/a":{ pt:"Veterinário/a",en:"Veterinarian",de:"Tierarzt/Tierärztin",fr:"Vétérinaire",it:"Veterinario/a" },
  "Agronomo/a":{ pt:"Agrônomo/a",en:"Agronomist",de:"Agraringenieur/in",fr:"Agronome",it:"Agronomo/a" },
  "Biologo/a":{ pt:"Biólogo/a",en:"Biologist",de:"Biologe/Biologin",fr:"Biologiste",it:"Biologo/a" },
  "Quimico/a":{ pt:"Químico/a",en:"Chemist",de:"Chemiker/in",fr:"Chimiste",it:"Chimico/a" },
  "Geologo/a":{ pt:"Geólogo/a",en:"Geologist",de:"Geologe/Geologin",fr:"Géologue",it:"Geologo/a" },
  "Asistente Social":{ pt:"Assistente Social",en:"Social Worker",de:"Sozialarbeiter/in",fr:"Travailleur/se social/e",it:"Assistente sociale" },
  "Sociologo/a":{ pt:"Sociólogo/a",en:"Sociologist",de:"Soziologe/Soziologin",fr:"Sociologue",it:"Sociologo/a" },
  "Artista plastico":{ pt:"Artista plástico/a",en:"Visual artist",de:"Bildender Künstler/in",fr:"Artiste plastique",it:"Artista plastico/a" },
  "Musico/a":{ pt:"Músico/a",en:"Musician",de:"Musiker/in",fr:"Musicien/ne",it:"Musicista" },
  "Fotografo/a":{ pt:"Fotógrafo/a",en:"Photographer",de:"Fotograf/in",fr:"Photographe",it:"Fotografo/a" },
  "Arbitro deportivo":{ pt:"Árbitro esportivo",en:"Sports referee",de:"Sportschiedsrichter/in",fr:"Arbitre sportif/ve",it:"Arbitro sportivo" },
  "Asesor/a financiero":{ pt:"Assessor/a financeiro/a",en:"Financial advisor",de:"Finanzberater/in",fr:"Conseiller/ère financier/ère",it:"Consulente finanziario/a" },
  "Medicina General":{ pt:"Medicina Geral",en:"General Medicine",de:"Allgemeinmedizin",fr:"Médecine générale",it:"Medicina Generale" },
  "Pediatria":{ pt:"Pediatria",en:"Pediatrics",de:"Pädiatrie",fr:"Pédiatrie",it:"Pediatria" },
  "Cardiologia":{ pt:"Cardiologia",en:"Cardiology",de:"Kardiologie",fr:"Cardiologie",it:"Cardiologia" },
  "Neurologia":{ pt:"Neurologia",en:"Neurology",de:"Neurologie",fr:"Neurologie",it:"Neurologia" },
  "Cirugia":{ pt:"Cirurgia",en:"Surgery",de:"Chirurgie",fr:"Chirurgie",it:"Chirurgia" },
  "Ginecologia":{ pt:"Ginecologia",en:"Gynecology",de:"Gynäkologie",fr:"Gynécologie",it:"Ginecologia" },
  "Traumatologia":{ pt:"Traumatologia",en:"Traumatology",de:"Traumatologie",fr:"Traumatologie",it:"Traumatologia" },
  "Dermatologia":{ pt:"Dermatologia",en:"Dermatology",de:"Dermatologie",fr:"Dermatologie",it:"Dermatologia" },
  "Psiquiatria":{ pt:"Psiquiatria",en:"Psychiatry",de:"Psychiatrie",fr:"Psychiatrie",it:"Psichiatria" },
  "Oncologia":{ pt:"Oncologia",en:"Oncology",de:"Onkologie",fr:"Oncologie",it:"Oncologia" },
  "Medicina Familiar":{ pt:"Medicina de Família",en:"Family Medicine",de:"Familienmedizin",fr:"Médecine de famille",it:"Medicina di Famiglia" },
  "Derecho Penal":{ pt:"Direito Penal",en:"Criminal Law",de:"Strafrecht",fr:"Droit pénal",it:"Diritto Penale" },
  "Derecho de Familia":{ pt:"Direito de Família",en:"Family Law",de:"Familienrecht",fr:"Droit de la famille",it:"Diritto di Famiglia" },
  "Derecho Civil":{ pt:"Direito Civil",en:"Civil Law",de:"Zivilrecht",fr:"Droit civil",it:"Diritto Civile" },
  "Derecho Laboral":{ pt:"Direito Trabalhista",en:"Labor Law",de:"Arbeitsrecht",fr:"Droit du travail",it:"Diritto del Lavoro" },
  "Derecho Comercial":{ pt:"Direito Comercial",en:"Commercial Law",de:"Handelsrecht",fr:"Droit commercial",it:"Diritto Commerciale" },
  "Derecho Administrativo":{ pt:"Direito Administrativo",en:"Administrative Law",de:"Verwaltungsrecht",fr:"Droit administratif",it:"Diritto Amministrativo" },
  "Derecho Internacional":{ pt:"Direito Internacional",en:"International Law",de:"Internationales Recht",fr:"Droit international",it:"Diritto Internazionale" },
  "Mediacion y Arbitraje":{ pt:"Mediação e Arbitragem",en:"Mediation & Arbitration",de:"Mediation und Schiedsverfahren",fr:"Médiation et arbitrage",it:"Mediazione e Arbitrato" },
  "Propiedad Intelectual":{ pt:"Propriedade Intelectual",en:"Intellectual Property",de:"Geistiges Eigentum",fr:"Propriété intellectuelle",it:"Proprietà Intellettuale" },
  "Psicologia Clinica":{ pt:"Psicologia Clínica",en:"Clinical Psychology",de:"Klinische Psychologie",fr:"Psychologie clinique",it:"Psicologia Clinica" },
  "Psicologia Infantil":{ pt:"Psicologia Infantil",en:"Child Psychology",de:"Kinderpsychologie",fr:"Psychologie infantile",it:"Psicologia Infantile" },
  "Psicologia Organizacional":{ pt:"Psicologia Organizacional",en:"Organizational Psychology",de:"Organisationspsychologie",fr:"Psychologie organisationnelle",it:"Psicologia Organizzativa" },
  "Psicologia Forense":{ pt:"Psicologia Forense",en:"Forensic Psychology",de:"Forensische Psychologie",fr:"Psychologie légale",it:"Psicologia Forense" },
  "Neuropsicologia":{ pt:"Neuropsicologia",en:"Neuropsychology",de:"Neuropsychologie",fr:"Neuropsychologie",it:"Neuropsicologia" },
  "Psicoterapia":{ pt:"Psicoterapia",en:"Psychotherapy",de:"Psychotherapie",fr:"Psychothérapie",it:"Psicoterapia" },
  "Ingenieria Civil":{ pt:"Engenharia Civil",en:"Civil Engineering",de:"Bauingenieurwesen",fr:"Génie civil",it:"Ingegneria Civile" },
  "Ingenieria Electrica":{ pt:"Engenharia Elétrica",en:"Electrical Engineering",de:"Elektrotechnik",fr:"Génie électrique",it:"Ingegneria Elettrica" },
  "Ingenieria Industrial":{ pt:"Engenharia Industrial",en:"Industrial Engineering",de:"Wirtschaftsingenieurwesen",fr:"Génie industriel",it:"Ingegneria Industriale" },
  "Ingenieria en Sistemas":{ pt:"Engenharia de Sistemas",en:"Systems Engineering",de:"Systemtechnik",fr:"Génie des systèmes",it:"Ingegneria dei Sistemi" },
  "Ingenieria Quimica":{ pt:"Engenharia Química",en:"Chemical Engineering",de:"Chemieingenieurwesen",fr:"Génie chimique",it:"Ingegneria Chimica" },
  "Ingenieria Agronomica":{ pt:"Engenharia Agronômica",en:"Agronomic Engineering",de:"Agrarwissenschaften",fr:"Génie agronomique",it:"Ingegneria Agronomica" },
  "Ingenieria Mecanica":{ pt:"Engenharia Mecânica",en:"Mechanical Engineering",de:"Maschinenbau",fr:"Génie mécanique",it:"Ingegneria Meccanica" },
  "Ingenieria Ambiental":{ pt:"Engenharia Ambiental",en:"Environmental Engineering",de:"Umwelttechnik",fr:"Génie environnemental",it:"Ingegneria Ambientale" },
  "Diseno Grafico":{ pt:"Design Gráfico",en:"Graphic Design",de:"Grafikdesign",fr:"Design graphique",it:"Design Grafico" },
  "Diseno UX/UI":{ pt:"Design UX/UI",en:"UX/UI Design",de:"UX/UI-Design",fr:"Design UX/UI",it:"Design UX/UI" },
  "Diseno Industrial":{ pt:"Design Industrial",en:"Industrial Design",de:"Industriedesign",fr:"Design industriel",it:"Design Industriale" },
  "Diseno de Moda":{ pt:"Design de Moda",en:"Fashion Design",de:"Modedesign",fr:"Design de mode",it:"Design di Moda" },
  "Diseno de Interiores":{ pt:"Design de Interiores",en:"Interior Design",de:"Innenarchitektur",fr:"Design d'intérieur",it:"Design di Interni" },
  "Diseno Web":{ pt:"Design Web",en:"Web Design",de:"Webdesign",fr:"Design Web",it:"Web Design" },
  "Arquitectura Residencial":{ pt:"Arquitetura Residencial",en:"Residential Architecture",de:"Wohnarchitektur",fr:"Architecture résidentielle",it:"Architettura Residenziale" },
  "Arquitectura Comercial":{ pt:"Arquitetura Comercial",en:"Commercial Architecture",de:"Gewerbearchitektur",fr:"Architecture commerciale",it:"Architettura Commerciale" },
  "Urbanismo":{ pt:"Urbanismo",en:"Urban Planning",de:"Stadtplanung",fr:"Urbanisme",it:"Urbanistica" },
  "Paisajismo":{ pt:"Paisagismo",en:"Landscape Architecture",de:"Landschaftsarchitektur",fr:"Paysagisme",it:"Paesaggistica" },
  "Contabilidad General":{ pt:"Contabilidade Geral",en:"General Accounting",de:"Allgemeine Buchhaltung",fr:"Comptabilité générale",it:"Contabilità Generale" },
  "Auditoria":{ pt:"Auditoria",en:"Auditing",de:"Wirtschaftsprüfung",fr:"Audit",it:"Revisione contabile" },
  "Impuestos y Tributos":{ pt:"Impostos e Tributos",en:"Taxes & Duties",de:"Steuern und Abgaben",fr:"Impôts et taxes",it:"Imposte e Tributi" },
  "Finanzas Corporativas":{ pt:"Finanças Corporativas",en:"Corporate Finance",de:"Unternehmensfinanzierung",fr:"Finance corporate",it:"Finanza Aziendale" },
  "Enfermeria General":{ pt:"Enfermagem Geral",en:"General Nursing",de:"Allgemeine Krankenpflege",fr:"Soins infirmiers généraux",it:"Infermieristica Generale" },
  "Enfermeria Pediatrica":{ pt:"Enfermagem Pediátrica",en:"Pediatric Nursing",de:"Kinderkrankenpflege",fr:"Soins infirmiers pédiatriques",it:"Infermieristica Pediatrica" },
  "Cuidados Intensivos":{ pt:"Cuidados Intensivos",en:"Intensive Care",de:"Intensivpflege",fr:"Soins intensifs",it:"Terapia Intensiva" },
  "Enfermeria Geriatrica":{ pt:"Enfermagem Geriátrica",en:"Geriatric Nursing",de:"Geriatrische Pflege",fr:"Soins infirmiers gériatriques",it:"Infermieristica Geriatrica" },
  "Odontologia General":{ pt:"Odontologia Geral",en:"General Dentistry",de:"Allgemeine Zahnmedizin",fr:"Dentisterie générale",it:"Odontoiatria Generale" },
  "Ortodoncia":{ pt:"Ortodontia",en:"Orthodontics",de:"Kieferorthopädie",fr:"Orthodontie",it:"Ortodonzia" },
  "Animales de Compania":{ pt:"Animais de Companhia",en:"Companion Animals",de:"Heimtiere",fr:"Animaux de compagnie",it:"Animali da Compagnia" },
  "Animales de Granja":{ pt:"Animais de Fazenda",en:"Farm Animals",de:"Nutztiere",fr:"Animaux de ferme",it:"Animali da Fattoria" },
  "Cirugia Veterinaria":{ pt:"Cirurgia Veterinária",en:"Veterinary Surgery",de:"Tierchirurgie",fr:"Chirurgie vétérinaire",it:"Chirurgia Veterinaria" },
  "Nutricion Animal":{ pt:"Nutrição Animal",en:"Animal Nutrition",de:"Tierernährung",fr:"Nutrition animale",it:"Nutrizione Animale" },
  "Musica Clasica":{ pt:"Música Clássica",en:"Classical Music",de:"Klassische Musik",fr:"Musique classique",it:"Musica Classica" },
  "Produccion Musical":{ pt:"Produção Musical",en:"Music Production",de:"Musikproduktion",fr:"Production musicale",it:"Produzione Musicale" },
  "Produccion Vegetal":{ pt:"Produção Vegetal",en:"Crop Production",de:"Pflanzenproduktion",fr:"Production végétale",it:"Produzione Vegetale" },
  "Produccion Animal":{ pt:"Produção Animal",en:"Animal Production",de:"Tierproduktion",fr:"Production animale",it:"Produzione Animale" },
  "Agricultura Organica":{ pt:"Agricultura Orgânica",en:"Organic Agriculture",de:"Biologische Landwirtschaft",fr:"Agriculture biologique",it:"Agricoltura Biologica" },
  "Rehabilitacion Motora":{ pt:"Reabilitação Motora",en:"Motor Rehabilitation",de:"Motorische Rehabilitation",fr:"Rééducation motrice",it:"Riabilitazione Motoria" },
  "Fisioterapia Deportiva":{ pt:"Fisioterapia Esportiva",en:"Sports Physiotherapy",de:"Sportphysiotherapie",fr:"Kinésithérapie sportive",it:"Fisioterapia Sportiva" },
  "Fisioterapia Neurologica":{ pt:"Fisioterapia Neurológica",en:"Neurological Physiotherapy",de:"Neurologische Physiotherapie",fr:"Kinésithérapie neurologique",it:"Fisioterapia Neurologica" },
  "Fisioterapia Pediatrica":{ pt:"Fisioterapia Pediátrica",en:"Pediatric Physiotherapy",de:"Pädiatrische Physiotherapie",fr:"Kinésithérapie pédiatrique",it:"Fisioterapia Pediatrica" },
};

const ROLES_GENERICOS = new Set([
  "auxiliar","tecnico","asistente","operador","agente","oficial",
  "encargado","responsable","jefe","director","gerente","coordinador","supervisor",
  "social","publico","publica","nacional","general","municipal","departamental",
  "central","regional","local","estatal","senior","junior","principal","adjunto",
  "interino","provisional","temporal","permanente","profesional","especialista",
]);

function normalizar(s) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function expandirKeyword(kw, lang, pais = "") {
  const result = [kw];
  const langs  = [lang, ...(PAIS_LANGS_EXTRA[pais.toUpperCase()] ?? [])];
  for (const l of langs) {
    if (!l || l === "es") continue;
    const tr = TR[kw]?.[l];
    if (tr && !result.includes(tr)) result.push(tr);
  }
  return result;
}

function calcularScore(concurso, perfil) {
  const lang         = PAIS_LANG[concurso.pais.toUpperCase()] ?? "es";
  const paisConcurso = concurso.pais.toUpperCase();
  const rawKws       = [...(perfil.servicios||[]),...(perfil.profesiones||[]),...(perfil.especialidades||[]),...(perfil.tecnicaturas||[])].filter(Boolean);

  const perfilKws = [];
  for (const raw of rawKws) {
    for (const v of expandirKeyword(raw, lang, paisConcurso))
      perfilKws.push({ kw: normalizar(v), canonico: normalizar(raw) });
  }

  const concursoKws = new Set([
    ...(concurso.keywords || []),
    ...normalizar(concurso.cargo || concurso.titulo).split(/\s+/).filter(w => w.length > 3),
  ]);

  if (perfilKws.length === 0 || concursoKws.size === 0) return { score: 0, keywords_match: [], cumple: false };

  const matched = [];
  for (const { kw: kp, canonico } of perfilKws) {
    if (matched.includes(canonico)) continue;
    const kpWords     = kp.split(" ").filter(w => w.length > 3);
    const esCompuesto = kpWords.length > 1;
    for (const kc of concursoKws) {
      const exactoOJobEspecifico = kc === kp || kc.includes(kp);
      const perfilContieneJob    = kp.includes(kc);
      const bloqueado = perfilContieneJob && esCompuesto && ROLES_GENERICOS.has(kc);
      if ((exactoOJobEspecifico || perfilContieneJob) && !bloqueado) { matched.push(canonico); break; }
    }
  }

  const totalUnicos = new Set(rawKws.map(normalizar)).size;
  let score = totalUnicos > 0 ? Math.round((matched.length / totalUnicos) * 80) : 0;

  const perfilPaisRaw = normalizar(perfil.pais || "uruguay");
  const perfilPaisISO = PAIS_ISO[perfilPaisRaw] || perfilPaisRaw.slice(0, 2).toUpperCase();
  if (perfilPaisISO === concurso.pais.toUpperCase()) score += 15;

  if (perfil.ciudad && concurso.lugar) {
    const cn = normalizar(perfil.ciudad), ln = normalizar(concurso.lugar);
    if (ln.includes(cn) || cn.includes(ln)) score += 5;
  }

  score = Math.min(score, 100);
  const ratioOk = matched.length > 0 && totalUnicos > 0 && (matched.length / totalUnicos) >= 0.5;
  return { score, keywords_match: matched, cumple: ratioOk && score >= 55 };
}

async function matchWorker(workerId) {
  const { data: perfil, error: perfilErr } = await db.from("profiles")
    .select("id, pais, ciudad, servicios, profesiones, especialidades, tecnicaturas, rol")
    .eq("id", workerId).single();

  if (perfilErr || !perfil) return { procesados: 0, error: perfilErr?.message };
  if (perfil.rol !== "worker") return { procesados: 0 };

  const paisRaw = (perfil.pais || "uruguay").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const pais    = PAIS_ISO[paisRaw] || paisRaw.slice(0, 2).toUpperCase();
  const hoy     = new Date().toISOString().slice(0, 10);

  const { data: concursos, error: concursosErr } = await db.from("concursos")
    .select("id, pais, cargo, titulo, keywords, lugar, fecha_cierre")
    .eq("activo", true).eq("pais", pais)
    .or(`fecha_cierre.gte.${hoy},fecha_cierre.is.null`);

  if (concursosErr) return { procesados: 0, error: concursosErr.message };
  if (!concursos?.length) return { procesados: 0 };

  const batch = concursos.map(c => {
    const { score, keywords_match, cumple } = calcularScore(c, perfil);
    return { concurso_id: c.id, worker_id: workerId, score, cumple, keywords_match, updated_at: new Date().toISOString() };
  });

  const { error: upsertErr } = await db.from("concurso_matches")
    .upsert(batch, { onConflict: "concurso_id,worker_id", ignoreDuplicates: false });

  if (upsertErr) return { procesados: 0, error: upsertErr.message };
  return { procesados: batch.length };
}

router.post('/', async (req, res) => {
  try {
    const body = req.body ?? {};

    if (body.todos) {
      const { data: workers } = await db.from("profiles")
        .select("id").eq("rol", "worker").eq("perfil_activo", true);

      if (!workers?.length) return res.json({ ok: true, workers: 0 });

      const BATCH = 20;
      let totalProcesados = 0;
      for (let i = 0; i < workers.length; i += BATCH) {
        const lote = workers.slice(i, i + BATCH);
        const results = await Promise.allSettled(lote.map(w => matchWorker(w.id)));
        for (const r of results) if (r.status === "fulfilled") totalProcesados += r.value.procesados;
      }

      // CUANDO MIGRES A HETZNER: cambiar URL por fetch('http://localhost:3000/notificar-matches')
      fetch('https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/notificar-matches', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(() => {});

      return res.json({ ok: true, workers: workers.length, matches_procesados: totalProcesados });
    }

    if (body.worker_id) {
      const result = await matchWorker(body.worker_id);
      return res.json({ ok: !result.error, ...result });
    }

    return res.status(400).json({ error: 'Enviar worker_id o todos:true' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
