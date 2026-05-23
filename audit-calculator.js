/**
 * ============================================================
 *  AUDIT SCRIPT – calculator.js
 *  Ejecutar: node audit-calculator.js
 * ============================================================
 *  Permite:
 *   • Configurar los inputs en la sección INPUTS CONFIGURABLES
 *   • Ver paso a paso cómo se calculan los resultados
 *   • Detectar valores anómalos en cada etapa
 * ============================================================
 */

'use strict';

// ============================================================
//  ▼▼▼  INPUTS CONFIGURABLES – edita estos valores  ▼▼▼
// ============================================================

const TIPO_COMBUSTIBLE = 'Diesel';
// Opciones: 'Gas Natural (Camisea)' | 'Gas Natural (Talara)' |
//           'GLP' | 'Diesel' | 'P.I. 6' | 'P.I. 500'

const TIPO_VAPOR = 'Saturado';
// Opciones: 'Saturado' | 'Sobrecalentado'

const INPUTS = {
  I9:  1739.3,  // Flujo de combustible      [kg/h]
  I10: 25,      // Temperatura combustible   [°C]
  I11: 30,      // Temperatura ambiente      [°C]
  I12: 50,      // Humedad relativa          [%]
  I13: 1,       // Velocidad del viento      [m/s]
  I14: 80,      // Temperatura agua entrada  [°C]
  I15: 200,     // Flujo purga               [kg/h]
  I16: 2200,    // Flujo total agua          [kg/h]
  I17: 200,     // Presión vapor             [PSI]
  I18: 200,     // Temperatura vapor (sobrecalentado) [°C]
  I19: 7,       // O₂ en gases chimenea      [%]
  I20: 350,     // CO en gases chimenea      [ppm]
  I21: 262.8,   // Temperatura gases chimenea [°C]
  I22: 3,       // Opacidad / número Bacharach [0-9]
  I23: 60,      // Temperatura sup. fondo    [°C]
  I24: 65,      // Temperatura sup. lateral  [°C]
  I25: 62,      // Temperatura sup. posterior[°C]
  I26: 63,      // Temperatura sup. anterior [°C]
  I35: 3.5,     // Precio combustible        [US$/kg o US$/m³]
  I36: 7920,    // Tiempo de operación       [h/año]
  I37: 10,      // % costo 1 (mano de obra)
  I38: 5,       // % costo 2 (mantenimiento)
  I39: 3,       // % costo 3 (agua)
  I40: 2,       // % costo 4 (químicos)
  I41: 1,       // % costo 5 (otros)
  I42: 0,       // % costo 6 (reservado)
  // Opcionales – dejar null si no aplica:
  I2:  null,    // Capacidad nominal          [kg vapor/h]
  I3:  null,    // Área superficial          [ft²]
  I4H: null,    // Diámetro caldera          [m]   (para pérdidas superficiales)
  I5H: null,    // Largo caldera             [m]   (para pérdidas superficiales)
};

// ============================================================
//  FIN DE INPUTS – no modificar lo que sigue salvo para debug
// ============================================================

// Cargamos las constantes y funciones internas del calculator
// copiándolas aquí de forma transparente para poder loguear
// cada sub-función de manera detallada.

const COMBUSTIBLES = {
  'Gas Natural (Camisea)': { C: 74.710, H: 23.637, O: 0.448,  N: 1.205,  S: 0.0001, PCI: 11619, C1: 0.5306, C2: 0.00036 },
  'Gas Natural (Talara)':  { C: 74.498, H: 23.442, O: 1.666,  N: 0.393,  S: 0.0001, PCI: 11514, C1: 0.5306, C2: 0.00036 },
  'GLP':                   { C: 82.2198,H: 17.77,  O: 0.0001, N: 0.0001, S: 0.01,   PCI: 11683, C1: 0.5162, C2: 0.00044 },
  'Diesel':                { C: 86.63,  H: 11.82,  O: 0.90,   N: 0.32,   S: 0.32,   PCI: 10166, C1: 0.4345, C2: 0.00044 },
  'P.I. 6':                { C: 88.09,  H: 10.04,  O: 0.35,   N: 0.13,   S: 1.30,   PCI: 9769,  C1: 0.4025, C2: 0.00044 },
  'P.I. 500':              { C: 88.19,  H: 9.99,   O: 0.15,   N: 0.05,   S: 1.50,   PCI: 9764,  C1: 0.4016, C2: 0.00044 },
};

const PT_IB = [0.1, 0.4, 1.0, 2.1, 3.0, 4.5, 6.1, 7.9, 10.0, 12.4];
const PMC = 12, PMH = 1, PMO = 16, PMN = 14, PMS = 32;
const PMCO = 28, PMCO2 = 44, PMO2 = 32, PMN2 = 28, PMSO2 = 64, PMH2O = 18;
const DHC = 7831, DHCO = 2415;
const Tr = 0;
const TOL = 0.001;
const SIGMA = 5.67e-8;
const EMISIVIDAD = 0.9;
const O2_PESO = 32.0, N2_PESO = 28.0;
const AIRE_PESO = O2_PESO * 0.23 + N2_PESO * 0.77;

// ─── Utilidades de log ───────────────────────────────────────

const SEP  = '─'.repeat(70);
const SEP2 = '═'.repeat(70);

function titulo(txt) {
  console.log('\n' + SEP2);
  console.log(`  ${txt}`);
  console.log(SEP2);
}

function seccion(txt) {
  console.log('\n' + SEP);
  console.log(`  ${txt}`);
  console.log(SEP);
}

function log(label, value, unit = '') {
  const v = typeof value === 'number' ? value.toFixed(6) : String(value);
  const pad = label.padEnd(45, '.');
  console.log(`  ${pad} ${v}${unit ? '  [' + unit + ']' : ''}`);
}

function warn(msg) {
  console.log(`  ⚠  ADVERTENCIA: ${msg}`);
}

function err(msg) {
  console.log(`  ✖  ERROR: ${msg}`);
}

// ─── Solver 3×3 (Cramer) ────────────────────────────────────

function solve3x3(A, D) {
  function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
         - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
         + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }
  const detA = det3(A);
  if (Math.abs(detA) < 1e-15) throw new Error('Sistema singular – determinante ≈ 0');
  function replaceCol(j) { return A.map((row, i) => row.map((val, k) => k === j ? D[i] : val)); }
  return [
    det3(replaceCol(0)) / detA,
    det3(replaceCol(1)) / detA,
    det3(replaceCol(2)) / detA,
  ];
}

// ─── FUNCIONES CON LOGGING ───────────────────────────────────

function audit_balance_materia(tipo) {
  seccion('PASO 1 – Balance de materia (composición del combustible)');
  const p = COMBUSTIBLES[tipo];
  log('C% en combustible', p.C, '%');
  log('H% en combustible', p.H, '%');
  log('O% en combustible', p.O, '%');
  log('N% en combustible', p.N, '%');
  log('S% en combustible', p.S, '%');
  log('PCI', p.PCI, 'kcal/kg');

  const frac_C = p.C / PMC;
  const frac_H = p.H / PMH;
  const frac_O = p.O / PMO;
  const frac_N = p.N / PMN;
  const frac_S = p.S / PMS;

  log('frac_C = C/PMC', frac_C);
  log('frac_H = H/PMH', frac_H);
  log('frac_O = O/PMO', frac_O);
  log('frac_N = N/PMN', frac_N);
  log('frac_S = S/PMS', frac_S);

  // Excluir fracciones molares negligibles (< 1e-3) para evitar que trazas de S u O
  // con masa% ≈ 0.0001 se conviertan en el mínimo y disparen PMComb a millones.
  const vals = [frac_C, frac_H, frac_O, frac_N, frac_S].filter(v => v > 1e-3);
  const Min = Math.min(...vals);
  log('Mínimo de fracciones (Min)', Min);

  const a = frac_C / Min;
  const b = frac_H / Min;
  const c = frac_O / Min;
  const d = frac_N / Min;
  const e = frac_S / Min;
  const PMComb = 100.0 / Min;

  log('a (átomos C normalizados)', a);
  log('b (átomos H normalizados)', b);
  log('c (átomos O normalizados)', c);
  log('d (átomos N normalizados)', d);
  log('e (átomos S normalizados)', e);
  log('PMComb (peso molecular comb)', PMComb, 'g/mol');

  if (a <= 0) warn('a ≤ 0: sin carbono en el combustible');
  if (b <= 0) warn('b ≤ 0: sin hidrógeno en el combustible');

  return { a, b, c, d, e, PMComb };
}

function audit_humedad(Ta, HR) {
  seccion('PASO 2 – Humedad absoluta del aire');
  log('Temperatura ambiente (Ta)', Ta, '°C');
  log('Humedad relativa (HR)', HR, '%');
  const exponent = -9.1359 + 0.8073 * Math.log(HR) + Ta * Math.exp(-2.992 + 0.002 * HR);
  log('Exponente de cálculo', exponent);
  const Habs = Math.exp(exponent);
  log('Humedad absoluta (Habs)', Habs, 'kg H₂O / kg aire seco');
  if (Habs < 0 || Habs > 0.1) warn(`Habs=${Habs.toFixed(4)} fuera del rango típico (0–0.1)`);
  return Habs;
}

function audit_perdidas(IB, I20) {
  seccion('PASO 3 – Pérdidas por hollín (Pt)');
  log('Opacidad / Bacharach (IB = I22)', IB);
  log('CO en chimenea (I20)', I20, 'ppm');
  let Pt;
  if (IB === -1) {
    Pt = 0.000000000221 * Math.pow(I20, 3) - 0.00000188 * Math.pow(I20, 2) + 0.00687 * I20 - 0.0534;
    log('Pt (Omitir aproximado, polinomio CO)', Pt, '%');
  } else if (IB >= 0 && IB < PT_IB.length) {
    Pt = PT_IB[Math.floor(IB)];
    log(`Pt desde tabla PT_IB[${Math.floor(IB)}]`, Pt, '%');
  } else {
    Pt = 2.52e-9 * Math.pow(I20, 3) - 3.32e-6 * Math.pow(I20, 2) + 0.00769 * I20;
    log('Pt calculado (fórmula polinómica)', Pt, '%');
  }
  if (Pt < 0) warn('Pt negativo – revisar entradas');
  if (Pt > 15) warn('Pt > 15%: pérdidas muy elevadas');
  return Pt;
}

function audit_bucle_conversion(a, b, c, d, e, PMComb, I9, PCI, Pt, I19, I20, C_pct) {
  seccion('PASO 4 – Bucle de conversión (iterativo)');
  log('a', a);  log('b', b);  log('c', c);
  log('d', d);  log('e', e);  log('PMComb', PMComb);
  log('I9 (flujo combustible)', I9, 'kg/h');
  log('PCI', PCI, 'kcal/kg');
  log('Pt (pérdidas hollín)', Pt, '%');
  log('I19 (O₂ chimenea)', I19, '%');
  log('I20 (CO chimenea)', I20, 'ppm');
  log('C_pct (% C en combustible)', C_pct, '%');

  let f = 1.0;
  const maxit = 10;
  let result;
  for (let iter = 0; iter < maxit; iter++) {
    console.log(`\n  -- Iteración ${iter + 1} --`);
    const d1 = f * a;
    const b2 = 0.5 - 100.0 / (I20 / 10000.0);
    const c2 = (1 + 79.0 / 21.0) * (a + b / 4.0 + e);
    const d2 = (79.0 / 42.0) * c - d / 2.0 + b / 4.0;
    const b3 = 50.0 + I19 / 2.0;
    const c3 = ((1 + 79.0 / 21.0) * I19 - 100.0) * (a + b / 4.0 + e);
    const d3 = (I19 / 4.0 - 25.0) * b - 100.0 * e + ((79.0 / 42.0) * c - d / 2.0) * I19;

    log('  f (fracción conversión)', f);
    log('  d1 = f*a', d1);
    log('  b2', b2); log('  c2', c2); log('  d2', d2);
    log('  b3', b3); log('  c3', c3); log('  d3', d3);

    const A = [[1, 1, 0], [0, b2, c2], [100, b3, c3]];
    const D = [d1, d2, d3];
    const [x, y, n] = solve3x3(A, D);
    log('  x (CO₂ / mol comb)', x);
    log('  y (CO  / mol comb)', y);
    log('  n (exceso O₂ estequiométrico)', n);

    const mc  = C_pct * 0.01;
    const mco = y * PMCO / PMComb;
    const f2  = 1.0 - ((Pt * PCI / 100.0) - mco * DHCO) / (mc * DHC);
    log('  mc = C_pct/100', mc);
    log('  mco = y*PMCO/PMComb', mco);
    log('  f2 (nueva fracción)', f2);

    if (y < 0) warn(`Iteración ${iter + 1}: y < 0 (CO negativo – posible inconsistencia en I19/I20)`);
    if (x < 0) warn(`Iteración ${iter + 1}: x < 0 (CO₂ negativo)`);
    if (n < 1)  warn(`Iteración ${iter + 1}: n < 1 (combustión sub-estequiométrica)`);

    if (Math.abs(f2 - f) < TOL) {
      console.log(`\n  ✓ Converge en iteración ${iter + 1} (|f2-f| = ${Math.abs(f2 - f).toExponential(3)})`);
      result = { f: f2, n, y, x };
      break;
    }
    f = f2;
    if (iter === maxit - 1) throw new Error('No convergió en el bucle de conversión');
  }
  return result;
}

function audit_flujos_aire(a, b, c, e, PMComb, I9, Habs, n) {
  seccion('PASO 5 – Flujos de aire');
  const FOA = (n * (a + b / 4.0 + e) - c / 2.0) * (32 / PMComb) * I9;
  const FNA = (79.0 / 21.0) * (n * (a + b / 4.0 + e) - c / 2.0) * (28 / PMComb) * I9;
  const FHA = (Habs / 18.0 * (n * (a + b / 4.0 + e) - c / 2.0) * (PMO2 + (79.0 / 21.0) * PMN2)) * (18 / PMComb) * I9;
  const FTA = FOA + FNA + FHA;
  log('FOA (flujo O₂ en aire)', FOA, 'kg/h');
  log('FNA (flujo N₂ en aire)', FNA, 'kg/h');
  log('FHA (flujo H₂O en aire)', FHA, 'kg/h');
  log('FTA (flujo total aire)', FTA, 'kg/h');
  if (FOA < 0) warn('FOA < 0: flujo de O₂ negativo');
  return { FOA, FNA, FHA, FTA };
}

function audit_flujos_chimenea(a, b, c, d, e, PMComb, I9, n, y, x, Habs, f1) {
  seccion('PASO 6 – Flujos en chimenea');
  const FCO2    = x * (44 / PMComb) * I9;
  const FCO     = y * (28 / PMComb) * I9;
  const FO2     = (n * (a + b / 4.0 + e) - x - y / 2.0 - b / 4.0 - e) * (32 / PMComb) * I9;
  const FN2     = ((79.0 / 21.0) * (n * (a + b / 4.0 + e) - c / 2.0) + d / 2.0) * (28 / PMComb) * I9;
  // R25 (FH₂O) = F147 (H₂O combustión del H₂) + F148 (H₂O del aire húmedo)
  const F147    = (b / 2.0) * (18 / PMComb) * I9;
  const F148    = (Habs / 18.0 * (n * (a + b / 4.0 + e) - c / 2.0) * (32 + 79.0 / 21.0 * 28)) * (18 / PMComb) * I9;
  const FH2O    = F147 + F148;
  const FSO2    = e * (64 / PMComb) * I9;
  const FHollin = (1 - f1) * a * (12 / PMComb) * I9;

  log('FCO₂  (flujo CO₂)', FCO2, 'kg/h');
  log('FCO   (flujo CO)', FCO, 'kg/h');
  log('FO₂   (flujo O₂ libre)', FO2, 'kg/h');
  log('FN₂   (flujo N₂)', FN2, 'kg/h');
  log('F147  (H₂O combustión H₂ – parte 1 de R25)', F147, 'kg/h');
  log('F148  (H₂O aire húmedo  – parte 2 de R25)', F148, 'kg/h');
  log('FH₂O  (R25 = F147+F148)', FH2O, 'kg/h');
  log('FSO₂  (flujo SO₂)', FSO2, 'kg/h');
  log('FHollín', FHollin, 'kg/h');

  const total = FCO2 + FCO + FO2 + FN2 + FH2O + FSO2 + FHollin;
  log('Total flujos chimenea (suma)', total, 'kg/h');

  if (FCO  > 1)  warn(`FCO = ${FCO.toFixed(3)} kg/h – CO elevado en chimenea`);
  if (FSO2 > 5)  warn(`FSO₂ = ${FSO2.toFixed(3)} kg/h – riesgo de corrosión ácida`);
  if (FO2  < 0)  warn('FO₂ < 0: exceso de O₂ negativo');

  return { FCO2, FCO, FO2, FN2, FH2O, F147, F148, FSO2, FHollin };
}

function audit_perdidas_calor_sensible(x, y, a, b, c, d, e, f1, n, PMComb, Habs, I9, I21) {
  seccion('PASO 7 – Pérdidas por calor sensible (gases chimenea)');
  const T1 = I21 + 273;
  const T2 = Tr + 273;
  const dT = I21 - Tr;
  log('T chimenea (I21)', I21, '°C');
  log('T1 = I21+273', T1, 'K');
  log('T2 = Tr+273', T2, 'K');
  log('dT = I21-Tr', dT, '°C');

  const nCO2 = x;
  const nCO  = y;
  const nO2  = n * (a + b / 4 + e) - x - y / 2 - b / 4 - e;
  const nN2  = (79 / 21) * (n * (a + b / 4 + e) - c / 2) + d / 2;
  const nH2O = (b / 2) + (Habs / 18) * (n * (a + b / 4 + e) - c / 2) * (PMO2 + (79 / 21) * PMN2);
  const nSO2 = e;
  const nC   = (1 - f1) * a;

  log('nCO₂', nCO2); log('nCO', nCO); log('nO₂', nO2);
  log('nN₂', nN2);   log('nH₂O', nH2O); log('nSO₂', nSO2); log('nC', nC);

  const CPCO2 = 10.34 + 0.00137 * ((T1*T1 - T2*T2) / dT) - 195500 / (T1*T2);
  const CPCO  = 6.6  + 0.0006  * ((T1*T1 - T2*T2) / dT);
  const CPO2  = 8.27 + 0.00129 * ((T1*T1 - T2*T2) / dT) - 187700 / (T1*T2);
  const CPN2  = 6.5  + 0.0005  * ((T1*T1 - T2*T2) / dT);
  const CPH2O = 8.22 + 0.000075 * ((T1*T1 - T2*T2) / dT) + 44.67e-8 * ((T1*T1*T1 - T2*T2*T2) / dT);
  const CPSO2 = 7.7  + 0.00265  * ((T1*T1 - T2*T2) / dT) - 27.67e-8 * ((T1*T1*T1 - T2*T2*T2) / dT);
  const CPC   = 2.673 + 0.0013085 * ((T1*T1 - T2*T2) / (T1 - T2)) - 116900 / (T1*T2);

  log('Cp CO₂', CPCO2, 'kcal/mol·°C');
  log('Cp CO', CPCO,   'kcal/mol·°C');
  log('Cp O₂', CPO2,   'kcal/mol·°C');
  log('Cp N₂', CPN2,   'kcal/mol·°C');
  log('Cp H₂O', CPH2O, 'kcal/mol·°C');
  log('Cp SO₂', CPSO2, 'kcal/mol·°C');
  log('Cp C', CPC,     'kcal/mol·°C');

  const R36 = (nCO2*CPCO2 + nCO*CPCO + nO2*CPO2 + nN2*CPN2 + nH2O*CPH2O + nSO2*CPSO2 + nC*CPC) * dT * I9 / PMComb;
  log('R36 (pérdidas calor sensible)', R36, 'kcal/h');
  if (R36 < 0) warn('R36 < 0: verifique T chimenea y temperatura de referencia');
  return R36;
}

function audit_perdidas_inquemados(FCO, Pt, PCI, I9) {
  seccion('PASO 8 – Pérdidas por inquemados');
  const Pig = FCO * DHCO;
  const Pis = Pt * PCI * I9 / 100 - Pig;
  log('FCO', FCO, 'kg/h');
  log('DHCO', DHCO, 'kcal/kg');
  log('Pig (inquemados gaseosos)', Pig, 'kcal/h');
  log('Pt * PCI * I9 / 100', Pt * PCI * I9 / 100, 'kcal/h');
  log('Pis (inquemados sólidos)', Pis, 'kcal/h');
  if (Pig < 0) warn('Pig negativo');
  if (Pis < 0) warn('Pis negativo – puede indicar inconsistencia entre CO y Pt');
  return { Pig, Pis };
}

function audit_balance_energia(R29, R30, R31, R32, R33, R34, R35, R36, R37, R38, R39, R40, R41) {
  seccion('PASO 10 – Balance de energía (verificación cierre)');
  log('Entradas:');
  log('  R29 calor combustión', R29, 'kcal/h');
  log('  R30 calor sensible comb', R30, 'kcal/h');
  log('  R31 calor sensible aire seco', R31, 'kcal/h');
  log('  R32 calor humedad aire', R32, 'kcal/h');
  log('  R33 calor agua alimentación', R33, 'kcal/h');
  log('  R34 total entradas', R34, 'kcal/h');
  log('Salidas:');
  log('  R35 calor vapor generado', R35, 'kcal/h');
  log('  R36 pérd. calor sensible', R36, 'kcal/h');
  log('  R37 pérd. inquemados sólidos', R37, 'kcal/h');
  log('  R38 pérd. inquemados gaseosos', R38, 'kcal/h');
  log('  R39 pérd. superficiales', R39 !== 777 ? R39 : 0, 'kcal/h');
  log('  R40 calor purga', R40, 'kcal/h');
  log('  R41 total salidas', R41, 'kcal/h');
  const diferencia = R34 - R41;
  log('Diferencia (entradas - salidas)', diferencia, 'kcal/h');
  const pct = Math.abs(diferencia / R34) * 100;
  log('Diferencia %', pct, '%');
  if (pct > 5) warn(`Cierre de energía con ${pct.toFixed(2)}% de error – revisar inputs`);
  else         console.log(`  ✓ Cierre energético aceptable (${pct.toFixed(2)}%)`);
}

// ─── AUDITORÍA PRINCIPAL ─────────────────────────────────────

try {
  titulo(`AUDITORÍA DE CÁLCULO – SmartBoiler calculator.js`);
  console.log(`  Combustible : ${TIPO_COMBUSTIBLE}`);
  console.log(`  Tipo vapor  : ${TIPO_VAPOR}`);

  seccion('INPUTS SUMINISTRADOS');
  for (const [k, v] of Object.entries(INPUTS)) {
    if (v !== null) log(k, v);
    else console.log(`  ${k.padEnd(45,'.')} null (no aplica)`);
  }

  const p = COMBUSTIBLES[TIPO_COMBUSTIBLE];
  if (!p) throw new Error(`Combustible '${TIPO_COMBUSTIBLE}' no reconocido. Opciones: ${Object.keys(COMBUSTIBLES).join(', ')}`);

  const { I9, I10, I11, I12, I13, I14, I15, I16, I17, I18,
          I19, I20, I21, I22, I23, I24, I25, I26,
          I35, I36, I37, I38, I39, I40, I41, I42, I2, I3 } = INPUTS;

  // ── Paso 1: Balance de materia
  const { a, b, c, d, e, PMComb } = audit_balance_materia(TIPO_COMBUSTIBLE);

  // ── Paso 2: Humedad
  const Habs = audit_humedad(I11, I12);

  // ── Paso 3: Pérdidas hollín
  const Pt = audit_perdidas(I22, I20);

  // ── Paso 4: Bucle de conversión
  const { f: f_conv, n, y, x } = audit_bucle_conversion(a, b, c, d, e, PMComb, I9, p.PCI, Pt, I19, I20, p.C);

  seccion('RESULTADOS INTERMEDIOS DEL BUCLE DE CONVERSIÓN');
  log('f (fracción de conversión)', f_conv);
  log('x (mol CO₂ / mol comb)', x);
  log('y (mol CO  / mol comb)', y);
  log('n (coef. exceso O₂)', n);
  log('Exceso de aire (%)', (n - 1) * 100, '%');

  // ── Paso 5: Flujos de aire
  const { FOA, FNA, FHA, FTA } = audit_flujos_aire(a, b, c, e, PMComb, I9, Habs, n);

  // ── Paso 6: Flujos en chimenea
  const chim = audit_flujos_chimenea(a, b, c, d, e, PMComb, I9, n, y, x, Habs, f_conv);

  // ── Paso 7: Pérdidas calor sensible
  const R36 = audit_perdidas_calor_sensible(x, y, a, b, c, d, e, f_conv, n, PMComb, Habs, I9, I21);

  // ── Paso 8: Inquemados
  const { Pig, Pis } = audit_perdidas_inquemados(chim.FCO, Pt, p.PCI, I9);
  const R38 = Pig;
  const R37 = Pis;

  // ── Paso 9: Pérdidas superficiales
  seccion('PASO 9 – Pérdidas superficiales (R39)');
  let R39 = 777;
  const { I4H, I5H } = INPUTS;
  if (I4H && I5H) {
    const Af = (Math.PI / 4) * I4H * I4H;
    const Ad = Math.PI * I4H / 2 * I5H;
    const Ap = (Math.PI / 4) * I4H * I4H;
    const Ai = Math.PI * I4H / 2 * I5H;
    const Hc = 10.45 - I13 + 10 * Math.sqrt(I13);
    log('Diámetro caldera (I4H)', I4H, 'm');
    log('Largo caldera (I5H)', I5H, 'm');
    log('Af (área fondo)', Af, 'm²');
    log('Ad (área lateral)', Ad, 'm²');
    log('Hc (coef. convección)', Hc, 'W/m²K');
    const Qcde  = Af * Hc * (I23 - I11) * 3600 / 4.184 / 1000;
    const Qcld  = Ad * Hc * (I24 - I11) * 3600 / 4.184 / 1000;
    const Qcpo  = Ap * Hc * (I25 - I11) * 3600 / 4.184 / 1000;
    const Qcli  = Ai * Hc * (I26 - I11) * 3600 / 4.184 / 1000;
    const Qrde  = Af * EMISIVIDAD * SIGMA * (Math.pow(I23+273,4) - Math.pow(I11+273,4)) * 3600 / 4.184 / 1000;
    const Qrld  = Ad * EMISIVIDAD * SIGMA * (Math.pow(I24+273,4) - Math.pow(I11+273,4)) * 3600 / 4.184 / 1000;
    const Qrpo  = Ap * EMISIVIDAD * SIGMA * (Math.pow(I25+273,4) - Math.pow(I11+273,4)) * 3600 / 4.184 / 1000;
    const Qrli  = Ai * EMISIVIDAD * SIGMA * (Math.pow(I26+273,4) - Math.pow(I11+273,4)) * 3600 / 4.184 / 1000;
    log('Qcde (conv fondo)', Qcde, 'kcal/h');
    log('Qcld (conv lateral)', Qcld, 'kcal/h');
    log('Qrde (rad fondo)', Qrde, 'kcal/h');
    log('Qrld (rad lateral)', Qrld, 'kcal/h');
    R39 = (Qrde + Qcde) + (Qrld + Qcld) + (Qrpo + Qcpo) + (Qrli + Qcli);
    log('R39 (total pérdidas sup)', R39, 'kcal/h');
  } else {
    console.log('  I4H / I5H no proporcionados → R39 = 777 (N/A)');
  }

  // ── Paso 10: Calores
  seccion('PASO 10 – Calores del balance de energía');
  const R29 = p.PCI * I9;
  const R30 = I9 * (p.C1 + p.C2 * I10) * (I10 - Tr);
  const HLw = (1 + I14 / 10000) * (I14 - Tr);

  // Entalpía líquido saturado
  const B240 = (-0.00000000000657 * Math.pow(I17,5) + 0.0000000133 * Math.pow(I17,4)   // HL saturado
    - 0.0000103 * Math.pow(I17,3) + 0.00393 * Math.pow(I17,2) - 0.928 * I17 + 110);
  // (replicamos calcula_HL con signo correcto)
  const HL_real = (0.00000000000657 * Math.pow(I17,5) - 0.0000000133 * Math.pow(I17,4) +
                   0.0000103 * Math.pow(I17,3) - 0.00393 * Math.pow(I17,2) + 0.928 * I17 + 110);

  // Entalpía vapor
  let HV;
  if (TIPO_VAPOR === 'Saturado') {
    HV = (-0.00000000000000887 * Math.pow(I17,6) + 0.0000000000208 * Math.pow(I17,5)
          - 0.0000000193 * Math.pow(I17,4) + 0.00000906 * Math.pow(I17,3)
          - 0.00236 * Math.pow(I17,2) + 0.354 * I17 + 643);
  } else {
    const T = I18 + 273;
    const Cv = (8.22 + 0.000075 * ((T*T - 273*273) / I18) + 44.67e-8 * ((T*T*T - 273*273*273) / I18) + 1.987) / 18;
    const Ts = (Math.exp(0.22187 * Math.log(I17 + 14.7) + 4.7692) - 32) / 1.8;
    const P_n = (I17 + 14.7) / 145.038;
    const FC  = ((-0.000000004475 * I18*I18 + 0.000005271 * I18 - 0.002321) * P_n*P_n +
                 (-0.0000000245  * I18*I18 + 0.00002512  * I18 + 0.01171)  * P_n +
                 ( 0.0000000925  * I18*I18 - 0.0001796   * I18 + 1.02));
    const HV_sat = (-0.00000000000000887 * Math.pow(I17,6) + 0.0000000000208 * Math.pow(I17,5)
                    - 0.0000000193 * Math.pow(I17,4) + 0.00000906 * Math.pow(I17,3)
                    - 0.00236 * Math.pow(I17,2) + 0.354 * I17 + 643);
    HV = (HV_sat + Cv * (I18 - Ts)) * FC;
    log('Ts (Tsat a P dada)', Ts, '°C');
    log('Cv (calor específico vapor)', Cv, 'kcal/kg·°C');
    log('FC (factor corrección)', FC);
    log('HV_sat', HV_sat, 'kcal/kg');
  }

  log('R29 (calor combustión Q_comb)', R29, 'kcal/h');
  log('R30 (calor sensible comb)', R30, 'kcal/h');
  log('HLw (entalpía agua entrada)', HLw, 'kcal/kg');
  log('HL_real (entalpía liq. sat)', HL_real, 'kcal/kg');
  log('HV  (entalpía vapor)', HV, 'kcal/kg');

  // Calor sensible aire seco
  const T1air = I11 + 273;
  const T2air = Tr + 273;
  const dTair = I11 - Tr;
  let R31 = 0;
  if (dTair !== 0) {
    const CP_aire = 0.00636 + 0.000000845 * ((T1air*T1air - T2air*T2air) / dTair)
                  - 0.000000000092 * ((T1air*T1air*T1air - T2air*T2air*T2air) / dTair);
    R31 = Habs * (FOA + FNA) * CP_aire * dTair * AIRE_PESO;
  }
  const R32 = FHA * (1 + I11 / 10000) * (I11 - Tr);

  log('R31 (calor sensible aire seco)', R31, 'kcal/h');
  log('R32 (calor humedad aire)', R32, 'kcal/h');

  // Balance para encontrar R19 (vapor generado)
  const denom = HLw + (I15 / (I16 - I15)) * (HLw - HL_real) - HV;
  log('Denominador balance vapor (denom)', denom, 'kcal/kg');
  if (Math.abs(denom) < 1e-6) warn('Denominador ≈ 0 al calcular R19 – posible división por cero');

  const R19 = (R36 + R37 + R38 + (R39 !== 777 ? R39 : 0) - R29 - R30 - R31 - R32) / denom;
  const R20 = (I15 / (I16 - I15)) * R19;
  const R16 = R19 + R20;
  const R33 = R16 * HLw;
  const R35 = R19 * HV;
  const R40 = R20 * HL_real;

  seccion('PASO 11 – Balance de masa (verificación cierre)');
  const R15 = I9;
  const R17 = FTA;
  const R18 = R15 + R16 + R17;

  const mass_outputs = R19 + R20 + chim.FCO2 + chim.FCO + chim.FO2 + chim.FN2 + chim.FH2O + chim.FSO2 + chim.FHollin;
  const mass_closure_error = R18 - mass_outputs;
  log('R15 (masa combustible)', R15, 'kg/h');
  log('R16 (masa agua + purga)', R16, 'kg/h');
  log('R17 (masa aire total)', R17, 'kg/h');
  log('R18 (total entradas masa)', R18, 'kg/h');
  log('Total salidas masa (sin ajuste)', mass_outputs, 'kg/h');
  log('Error cierre de masa', mass_closure_error, 'kg/h');
  if (Math.abs(mass_closure_error) < 0.5) {
    console.log(`  ✓ Cierre de masa dentro de tolerancia (error=${mass_closure_error.toFixed(4)} kg/h), ajuste aplicado en FN₂`);
  } else {
    warn(`Error de cierre de masa = ${mass_closure_error.toFixed(3)} kg/h > 0.5 – verificar entradas`);
  }

  const R34 = R29 + R30 + R31 + R32 + R33;
  const R41 = R35 + R36 + R37 + R38 + (R39 !== 777 ? R39 : 0) + R40;

  audit_balance_energia(R29, R30, R31, R32, R33, R34, R35, R36, R37, R38, R39, R40, R41);

  // ── Paso 12: Temperatura de llama (R3) – Newton-Raphson
  const rd = v => Math.round(v * 100) / 100;
  seccion('PASO 12 – Temperatura de llama (R3) – Newton-Raphson');

  const QN = R29 + R30 + R31 + R32 - R37 - R38 - (R39 !== 777 ? R39 : 0);
  log('QN = R29+R30+R31+R32−R37−R38−R39  (Excel B276)', QN, 'kcal/h');

  // F(T) = B276 − SUM(B297:B303)   donde cada B_i = (F_i÷C_i) × (a·T³+b·T²+c·T+d) × T
  // Ki = (R_i/PM_i) · H_i(T)   donde H_i(T) = (a·T³ + b·T² + c·T + d)·T  (= Cp_i(T)·T)
  // F147 y F148 vienen de PASO 6 (descomposición de R25)
  log('F147 (H₂O combustión, de PASO 6)', chim.F147, 'kg/h');
  log('F148 (H₂O aire húmedo, de PASO 6)', chim.F148, 'kg/h');

  // Orden idéntico al Excel: B297→CO₂, B298→CO, B299→O₂, B300→N₂, B301→H₂O, B302→SO₂, B303→C
  const COEF_H = [
    { R: chim.FCO2,             PM: PMCO2,  a: 1.136e-10,    b:-6.936e-7,    c: 0.002901,  d: 9.571,  nom: 'KCO2' },  // B297  Excel F143÷C96
    { R: chim.FCO,              PM: PMCO,   a: 0,            b: 0,           c: 0.0006,    d: 6.9276, nom: 'KCO'  },  // B298  Excel F144÷C97
    { R: chim.FO2,              PM: PMO2,   a: 1.0907e-10,   b:-6.6591e-7,   c: 0.002760,  d: 7.5181, nom: 'KO2'  },  // B299  Excel F145÷C99
    { R: chim.FN2,              PM: PMN2,   a: 0,            b: 0,           c: 0.0005,    d: 6.773,  nom: 'KN2'  },  // B300  Excel F146÷C98
    { R: chim.F147 + chim.F148, PM: PMH2O,  a: 0,            b: 4.467e-7,    c: 0.0004408, d: 8.361,  nom: 'KH2O' },  // B301  Excel (F147+F148)÷C101
    { R: chim.FSO2,             PM: PMSO2,  a: 0,            b:-2.767e-7,    c: 0.002423,  d: 9.085,  nom: 'KSO2' },  // B302  Excel F149÷C100
    { R: chim.FHollin,          PM: PMC,    a: 6.7928e-11,   b:-4.14729e-7,  c: 0.002224,  d: 2.4805, nom: 'KC'   },  // B303  Excel F150÷C102
  ];

  // Mostrar R_i/PM_i (caudal molar de cada componente)
  COEF_H.forEach(g => log(`  ${g.nom}: R/PM`, rd(g.R / g.PM), 'kmol/h'));

  // F(T) = B276 − SUM(B297:B303)
  const FT_llama  = T => QN - COEF_H.reduce((s, g) =>
    s + (g.R / g.PM) * (g.a*T*T*T*T + g.b*T*T*T + g.c*T*T + g.d*T), 0);
  const FpT_llama = T =>    - COEF_H.reduce((s, g) =>
    s + (g.R / g.PM) * (4*g.a*T*T*T  + 3*g.b*T*T  + 2*g.c*T  + g.d), 0);

  // Bucle Newton-Raphson:
  //   B278 = T_actual  (empieza en 1000, se actualiza a T2 cada vuelta)
  //   B314 = F(T)  = B276 − SUM(B297:B303)  [QN − ΣKi]
  //   B315 = F'(T) = −SUM(kCO2′+kCO′+kO2′+kN2′+kH2O′+kSO2′+kC′)
  //   T2   = B278 − B314/B315
  let T1 = 1000; // B278 inicial = 1000 °C
  log('T1 / B278 (estimación inicial)', T1, '°C');
  const regT = [T1];
  for (let i = 1; i <= 50; i++) {
    const ft  = FT_llama(T1);   // B314 = F(T)  = B276 − SUM(B297:B303)
    const fpt = FpT_llama(T1);  // B315 = F'(T) = −SUM(ki′)
    console.log(`    iter ${i}: B278=${T1.toFixed(2)}  B314=F(T)=${ft.toFixed(2)}  B315=F'(T)=${fpt.toFixed(2)}`);
    if (Math.abs(fpt) < 1e-9) { warn("F'(T)≈0, deteniendo iteración"); break; }
    const T2 = T1 - ft / fpt;   // T2 = B278 − B314/B315
    regT.push(T2);
    // Condicional: |B278−T2| < 0.2 → converge; si no, B278 = T2 y siguiente iteración
    if (Math.abs(T1 - T2) < 0.2) {
      T1 = T2;  // B278 ← T2
      const ft_f = FT_llama(T1), fpt_f = FpT_llama(T1);
      console.log(`    iter ${i+1}: B278=${T1.toFixed(2)}  B314=F(T)=${ft_f.toFixed(2)}  B315=F'(T)=${fpt_f.toFixed(2)}`);
      console.log(`    ✓ Convergencia en ${i} iteraciones  |ΔT|=${Math.abs(T2 - regT[regT.length-2]).toFixed(4)} °C`);
      break;
    }
    T1 = T2;  // B278 ← T2
  }
  const R3 = Math.round(T1 * 10) / 10;
  log('R3 – Temperatura de llama', R3, '°C');
  log('Registro iteraciones T', regT.map(t => t.toFixed(1)).join(' → '));

  // ── RESULTADOS FINALES
  titulo('RESULTADOS FINALES');

  seccion('BALANCE DE MASA [kg/h]');
  log('R15 – Combustible (entrada)', rd(R15));
  log('R16 – Agua total (vapor + purga)', rd(R16));
  log('R17 – Aire total', rd(R17));
  log('R18 – TOTAL ENTRADAS', rd(R18));
  log('R19 – Vapor generado', rd(R19));
  log('R20 – Purga', rd(R20));
  log('R21 – CO₂  chimenea', rd(chim.FCO2));
  log('R22 – CO   chimenea', rd(chim.FCO));
  log('R23 – O₂   chimenea', rd(chim.FO2));
  log('R24 – N₂   chimenea', rd(chim.FN2 + mass_closure_error));
  log('R25 – H₂O  chimenea', rd(chim.FH2O));
  log('R26 – SO₂  chimenea', rd(chim.FSO2));
  log('R27 – Hollín chimenea', rd(chim.FHollin));

  seccion('BALANCE DE ENERGÍA [kcal/h]');
  log('R29 – Calor combustión', rd(R29));
  log('R30 – Calor sensible combustible', rd(R30));
  log('R31 – Calor sensible aire seco', rd(R31));
  log('R32 – Calor humedad aire', rd(R32));
  log('R33 – Calor agua alimentación', rd(R33));
  log('R34 – TOTAL ENTRADAS', rd(R34));
  log('R35 – Calor útil (vapor)', rd(R35));
  log('R36 – Pérd. calor sensible gases', rd(R36));
  log('R37 – Pérd. inquemados sólidos', rd(R37));
  log('R38 – Pérd. inquemados gaseosos', rd(R38));
  log('R39 – Pérd. superficiales', R39 !== 777 ? rd(R39) : 777);
  log('R40 – Calor purga', rd(R40));
  log('R41 – TOTAL SALIDAS', rd(R41));

  seccion('INDICADORES COM / EFI / EMISIONES');
  const R1A_vals = ['Excelente','Muy buena','Buena','Aceptable','Pobre','Deficiente','Muy deficiente','Critica','Peligrosa','Muy peligrosa'];
  const clasif = Pt < 0.25 ? 'Excelente' : Pt < 0.7 ? 'Muy buena' : Pt < 1.55 ? 'Buena' : Pt < 2.55 ? 'Aceptable' : Pt < 3.75 ? 'Pobre' : Pt < 5.3 ? 'Deficiente' : Pt < 7 ? 'Muy deficiente' : Pt < 8.95 ? 'Critica' : Pt < 11 ? 'Peligrosa' : 'Muy peligrosa';
  log('R1A – Clasificación hollín', clasif);
  log('R1B – Exceso de aire', rd((n - 1) * 100), '%');
  log('R1C – Ratio aire/comb', rd(R17 / R15));
  log('R2A – Grado de conversión', rd(100 - Pt), '%');
  log('R3  – Temperatura de llama', R3, '°C');
  log('R2B – % Inquem. sól / Q_comb', rd(Pt), '%');
  log('R2C – % Inquem. gas / Q_comb', rd((R38 / R29) * 100), '%');

  const r8  = 100 - (I37 + I38 + I39 + I40 + I41 + I42);
  const r7  = (R19 * r8 !== 0) ? (0.397 * I35 * R29) / (R19 * r8) : 777;
  log('R7  – Costo vapor generado', rd(r7), 'US$/ton');
  log('R8  – % combustible en costos', rd(r8), '%');

  const _deltaH = HV - HLw;
  const R5_val = _deltaH > 0 ? 539 / _deltaH : 777;
  const R4_val = (I2 && I2 !== 0 && R5_val !== 777) ? (R19 / (I2 * R5_val)) * 100 : 777;
  const R6A_val = R19 !== 0 ? R29 / R19 : 777;
  const R6B_val = (I3 && I3 !== 0) ? R19 / (I3 * 0.092903) : 777;
  log('R4  – Factor de carga', R4_val !== 777 ? rd(R4_val) : 777, '%');
  log('R5  – Factor de evaporación', rd(R5_val));
  log('R6A – Calor de combustión/vapor', R6A_val !== 777 ? rd(R6A_val) : 777, 'kcal/kg');
  log('R6B – Vapor por superficie', R6B_val !== 777 ? rd(R6B_val) : 777, 'kg/h/m²');

  const ratioBase = chim.FCO2 + chim.FCO + chim.FO2 + chim.FN2 + chim.FH2O + chim.FSO2 + chim.FHollin;
  log('R42 – Ratio CO₂  (mg/kcal)', rd((chim.FCO2 / R29) * 1e6));
  log('R43 – Ratio CO   (mg/kcal)', rd((chim.FCO  / R29) * 1e6));
  log('R44 – Ratio Hollín (mg/kcal)', rd((chim.FHollin / R29) * 1e6));
  log('R45 – Ratio SO₂  (mg/kcal)', rd((chim.FSO2  / R29) * 1e6));

  seccion('TEMPERATURA DE ROCÍO ÁCIDO');
  const n_h2o_comb  = b / 2.0;
  const n_h2o_air   = (Habs / 18.0) * (n * (a + b / 4.0 + e) - c / 2.0) * (PMO2 + (79.0 / 21.0) * PMN2);
  const n_h2o_total = n_h2o_comb + n_h2o_air;
  const n_total_mol = x + y
    + (n * (a + b / 4.0 + e) - x - y / 2.0 - b / 4.0 - e)
    + ((79.0 / 21.0) * (n * (a + b / 4.0 + e) - c / 2.0) + d / 2.0)
    + n_h2o_total + e + ((1 - f_conv) * a);
  log('n_H₂O combustión', n_h2o_comb);
  log('n_H₂O aire', n_h2o_air);
  log('n_H₂O total', n_h2o_total);
  log('n_SO₃ (= e)', e);
  log('n_total moles chimenea', n_total_mol);

  let R50 = 777;
  if (e > 0 && n_h2o_total > 0 && n_total_mol > 0) {
    const ratio_h2o = n_h2o_total / n_total_mol;
    const ratio_so3 = e / n_total_mol;
    R50 = 203.25
        + 27.6  * Math.log10(ratio_h2o)
        + 10.83 * Math.log10(ratio_so3)
        + 1.06  * Math.pow(Math.log10(ratio_so3 + 8.0), 2.19);
    log('Ratio H₂O/total', ratio_h2o);
    log('Ratio SO₃/total', ratio_so3);
    log('R50 – Temperatura de rocío ácido', rd(R50), '°C');
    if (R50 > I21) warn(`T rocío ácido (${rd(R50)}°C) > T chimenea (${I21}°C) – riesgo de corrosión`);
  } else {
    console.log('  R50 = 777 (N/A – sin azufre o condición inválida)');
  }

  titulo('FIN DE AUDITORÍA');

} catch (error) {
  err(error.message);
  console.error(error.stack);
  process.exit(1);
}
