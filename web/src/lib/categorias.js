// Categorías de trabajo para páginas SEO
// URL slug → configuración de filtro + nombres en todos los idiomas

export const CATEGORIAS = {
  'concurso-publico': {
    // Público = todo lo que NO es privado ni empleo genérico (incluye los null,
    // que son la mayoría de los concursos oficiales scrapeados, ej. Uruguay).
    filtro: { publico: true },
    nombres: {
      es: 'Concurso Público', pt: 'Concurso Público', en: 'Public Competition',
      fr: 'Concours Public', it: 'Concorso Pubblico', de: 'Öffentliche Ausschreibung',
      sv: 'Offentlig Utlysning', no: 'Offentlig Utlysning', ja: '公募コンクール',
    },
    desc: {
      es: (p) => `Concursos públicos abiertos en ${p}. Inscripciones vigentes, actualizadas diariamente.`,
      pt: (p) => `Concursos públicos abertos em ${p}. Inscrições abertas, atualizadas diariamente.`,
      en: (p) => `Open public competitions in ${p}. Active registrations, updated daily.`,
      fr: (p) => `Concours publics ouverts en ${p}. Inscriptions en cours, mises à jour quotidiennement.`,
      it: (p) => `Concorsi pubblici aperti in ${p}. Iscrizioni attive, aggiornate quotidianamente.`,
      de: (p) => `Offene Stellenausschreibungen in ${p}. Aktuelle Bewerbungen, täglich aktualisiert.`,
      sv: (p) => `Öppna offentliga utlysningar i ${p}. Aktiva ansökningar, uppdateras dagligen.`,
      no: (p) => `Åpne offentlige stillinger i ${p}. Aktive søknader, oppdateres daglig.`,
      ja: (p) => `${p}の公開コンクール。毎日更新。`,
    },
  },
  'tecnologia': {
    filtro: { keywords: ['tecnolog','software','sistema','inform','developer','programad','data','IT ','TI '] },
    nombres: {
      es: 'Tecnología', pt: 'Tecnologia', en: 'Technology',
      fr: 'Technologie', it: 'Tecnologia', de: 'Technologie',
      sv: 'Teknologi', no: 'Teknologi', ja: 'テクノロジー',
    },
    desc: {
      es: (p) => `Empleos de tecnología, sistemas e informática en ${p}. Desarrolladores, analistas y más.`,
      pt: (p) => `Vagas de tecnologia, sistemas e informática em ${p}. Desenvolvedores, analistas e mais.`,
      en: (p) => `Technology, IT and software jobs in ${p}. Developers, analysts and more.`,
      fr: (p) => `Emplois en technologie, systèmes et informatique en ${p}.`,
      it: (p) => `Lavori di tecnologia, sistemi e informatica in ${p}.`,
      de: (p) => `Technologie-, IT- und Softwarejobs in ${p}.`,
      sv: (p) => `Teknik-, IT- och mjukvarujobb i ${p}.`,
      no: (p) => `Teknologi-, IT- og programvarejobber i ${p}.`,
      ja: (p) => `${p}のIT・ソフトウェア求人。`,
    },
  },
  'salud': {
    filtro: { keywords: ['salud','médic','medic','enfermeri','hospital','sanitari','saúde','saude','health','psicolog','farmac','odontolog','kinesiolog'] },
    nombres: {
      es: 'Salud', pt: 'Saúde', en: 'Health',
      fr: 'Santé', it: 'Salute', de: 'Gesundheit',
      sv: 'Hälsa', no: 'Helse', ja: '医療・健康',
    },
    desc: {
      es: (p) => `Empleos en salud, medicina y enfermería en ${p}. Médicos, enfermeros, psicólogos y más.`,
      pt: (p) => `Vagas em saúde, medicina e enfermagem em ${p}. Médicos, enfermeiros, psicólogos e mais.`,
      en: (p) => `Health, medicine and nursing jobs in ${p}. Doctors, nurses, psychologists and more.`,
      fr: (p) => `Emplois en santé, médecine et soins infirmiers en ${p}.`,
      it: (p) => `Lavori in sanità, medicina e infermieristica in ${p}.`,
      de: (p) => `Jobs in Gesundheit, Medizin und Pflege in ${p}.`,
      sv: (p) => `Jobb inom hälsa, medicin och vård i ${p}.`,
      no: (p) => `Jobber innen helse, medisin og sykepleie i ${p}.`,
      ja: (p) => `${p}の医療・看護求人。`,
    },
  },
  'educacion': {
    filtro: { tipo_tarea_like: 'Docentes', keywords: ['docente','maestro','profesor','educac','ensino','escola','teacher','education','pedagog','primaria','secundaria','universit'] },
    nombres: {
      es: 'Educación y Docentes', pt: 'Educação e Docentes', en: 'Education & Teachers',
      fr: 'Éducation et Enseignants', it: 'Istruzione e Docenti', de: 'Bildung und Lehrkräfte',
      sv: 'Utbildning och Lärare', no: 'Utdanning og Lærere', ja: '教育・教員',
    },
    desc: {
      es: (p) => `Empleos docentes y educativos en ${p}. Maestros, profesores y cargos en instituciones educativas.`,
      pt: (p) => `Vagas docentes e educacionais em ${p}. Professores e cargos em instituições de ensino.`,
      en: (p) => `Teaching and education jobs in ${p}. Teachers and positions in educational institutions.`,
      fr: (p) => `Emplois dans l'enseignement en ${p}. Enseignants et postes dans les établissements scolaires.`,
      it: (p) => `Lavori nell'istruzione in ${p}. Insegnanti e posizioni nelle istituzioni educative.`,
      de: (p) => `Lehr- und Bildungsjobs in ${p}. Lehrer und Stellen in Bildungseinrichtungen.`,
      sv: (p) => `Lärar- och utbildningsjobb i ${p}.`,
      no: (p) => `Lærer- og utdanningsjobber i ${p}.`,
      ja: (p) => `${p}の教育・教員求人。`,
    },
  },
  'administracion': {
    filtro: { tipo_tarea_like: 'Administrativas', keywords: ['admin','secretari','gestión','gestion','recursos humanos','contabil','contador','finanz','tesorero','RRHH'] },
    nombres: {
      es: 'Administración', pt: 'Administração', en: 'Administration',
      fr: 'Administration', it: 'Amministrazione', de: 'Verwaltung',
      sv: 'Administration', no: 'Administrasjon', ja: '行政・管理',
    },
    desc: {
      es: (p) => `Empleos administrativos y de gestión en ${p}. Secretarias, contadores, recursos humanos y más.`,
      pt: (p) => `Vagas administrativas e de gestão em ${p}. Secretárias, contadores, RH e mais.`,
      en: (p) => `Administrative and management jobs in ${p}. Secretaries, accountants, HR and more.`,
      fr: (p) => `Emplois administratifs et de gestion en ${p}.`,
      it: (p) => `Lavori amministrativi e gestionali in ${p}.`,
      de: (p) => `Verwaltungs- und Managementjobs in ${p}.`,
      sv: (p) => `Administrativa och chefsjobb i ${p}.`,
      no: (p) => `Administrative og ledelsesjobber i ${p}.`,
      ja: (p) => `${p}の行政・管理求人。`,
    },
  },
  'gobierno': {
    filtro: { keywords: ['ministerio','gobierno','municipal','municipio','intendencia','gobernaci','federal','estado ','prefeitura','câmara','senado','congreso','alcald'] },
    nombres: {
      es: 'Gobierno y Sector Público', pt: 'Governo e Setor Público', en: 'Government & Public Sector',
      fr: 'Gouvernement et Secteur Public', it: 'Governo e Settore Pubblico', de: 'Regierung und öffentlicher Sektor',
      sv: 'Regering och offentlig sektor', no: 'Regjering og offentlig sektor', ja: '政府・公共部門',
    },
    desc: {
      es: (p) => `Empleos en el gobierno y sector público de ${p}. Ministerios, municipios, organismos del estado.`,
      pt: (p) => `Vagas no governo e setor público de ${p}. Ministérios, municípios, órgãos do estado.`,
      en: (p) => `Government and public sector jobs in ${p}. Ministries, municipalities, state agencies.`,
      fr: (p) => `Emplois dans le gouvernement et le secteur public de ${p}.`,
      it: (p) => `Lavori nel governo e settore pubblico di ${p}.`,
      de: (p) => `Regierungs- und öffentliche Sektorjobs in ${p}.`,
      sv: (p) => `Regerings- och offentliga sektorjobb i ${p}.`,
      no: (p) => `Regjerings- og offentlige sektorjobber i ${p}.`,
      ja: (p) => `${p}の政府・公共部門求人。`,
    },
  },
}

export const SLUGS_CATEGORIA = Object.keys(CATEGORIAS)
