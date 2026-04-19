/**
 * Motor de cálculo – portado de calculator.py (EnerAPP2)
 * NO modificar sin sincronizar con la versión Python original.
 */

// --- FICHAS TÉCNICAS ---
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
const B = 0.90;
const Tr = 0;
const TOL = 0.001;
const SIGMA = 5.67e-8;
const EMISIVIDAD = 0.9;
const O2_PESO = 32.0, N2_PESO = 28.0;
const AIRE_PESO = O2_PESO * 0.23 + N2_PESO * 0.77;


// --- 3×3 matrix solver (Cramer's rule) ---
function solve3x3(A, D) {
  // A is [[a00,a01,a02],[a10,a11,a12],[a20,a21,a22]], D is [d0,d1,d2]
  function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
         - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
         + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }
  const detA = det3(A);
  if (Math.abs(detA) < 1e-15) {
    throw new Error('Sistema singular – determinante ≈ 0');
  }
  // Replace column j with D to get numerator determinants
  function replaceCol(j) {
    return A.map((row, i) => row.map((val, k) => k === j ? D[i] : val));
  }
  const x = det3(replaceCol(0)) / detA;
  const y = det3(replaceCol(1)) / detA;
  const z = det3(replaceCol(2)) / detA;
  return [x, y, z];
}


function calcula_balance_materia(tipo_combustible) {
  const p = COMBUSTIBLES[tipo_combustible];
  const frac_C = p.C / PMC;
  const frac_H = p.H / PMH;
  const frac_O = p.O / PMO;
  const frac_N = p.N / PMN;
  const frac_S = p.S / PMS;
  const vals = [frac_C, frac_H, frac_O, frac_N, frac_S].filter(v => v > 0);
  const Min = Math.min(...vals);
  const a = frac_C / Min;
  const b = frac_H / Min;
  const c = frac_O / Min;
  const d = frac_N / Min;
  const e = frac_S / Min;
  const PMComb = 100.0 / Min;
  return { a, b, c, d, e, PMComb };
}


function calcula_humedad(Ta, HR) {
  const exponent = -9.1359 + 0.8073 * Math.log(HR) + Ta * Math.exp(-2.992 + 0.002 * HR);
  return Math.exp(exponent);
}


function calcula_perdidas(IB, I20) {
  if (IB >= 0 && IB < PT_IB.length) {
    return PT_IB[Math.floor(IB)];
  }
  return 2.52e-9 * Math.pow(I20, 3) - 3.32e-6 * Math.pow(I20, 2) + 0.00769 * I20;
}


function bucle_conversion(a, b, c, d, e, PMComb, I9, PCI, Pt, I19, I20, C_pct, maxit = 10, tol = TOL) {
  let f = 1.0;
  for (let iter = 0; iter < maxit; iter++) {
    const d1 = f * a;
    const b2 = 0.5 - 100.0 / (I20 / 10000.0);
    const c2 = (1 + 79.0 / 21.0) * (a + b / 4.0 + e);
    const d2 = (79.0 / 42.0) * c - d / 2.0 + b / 4.0;
    const b3 = 50.0 + I19 / 2.0;
    const c3 = ((1 + 79.0 / 21.0) * I19 - 100.0) * (a + b / 4.0 + e);
    const d3 = (I19 / 4.0 - 25.0) * b - 100.0 * e + ((79.0 / 42.0) * c - d / 2.0) * I19;

    const A = [
      [1,  1,  0 ],
      [0,  b2, c2],
      [100, b3, c3]
    ];
    const D = [d1, d2, d3];

    const [x, y, n] = solve3x3(A, D);

    const mc = C_pct * 0.01;
    const mco = y * PMCO / PMComb;
    const f2 = 1.0 - ((Pt * PCI / 100.0) - mco * DHCO) / (mc * DHC);

    if (Math.abs(f2 - f) < tol) {
      return { f: f2, n, y, x };
    }
    f = f2;
  }
  throw new Error('No convergió en el bucle de conversión');
}


function calcula_flujos_aire(a, b, c, e, PMComb, I9, Habs, n) {
  const FOA = (n * (a + b / 4.0 + e) - c / 2.0) * (32 / PMComb) * I9;
  const FNA = (79.0 / 21.0) * (n * (a + b / 4.0 + e) - c / 2.0) * (28 / PMComb) * I9;
  const FHA = (Habs / 18.0 * (n * (a + b / 4.0 + e) - c / 2.0) * (PMO2 + (79.0 / 21.0) * PMN2)) * (18 / PMComb) * I9;
  return { FOA, FNA, FHA, FTA: FOA + FNA + FHA };
}


function flujos_chimenea(a, b, c, d, e, PMComb, I9, n, y, x, Habs, f1) {
  const FCO2 = x * (44 / PMComb) * I9;
  const FCO  = y * (28 / PMComb) * I9;
  const FO2  = (n * (a + b / 4.0 + e) - x - y / 2.0 - b / 4.0 - e) * (32 / PMComb) * I9;
  const FN2  = ((79.0 / 21.0) * (n * (a + b / 4.0 + e) - c / 2.0) + d / 2.0) * (28 / PMComb) * I9;
  const FH2O = (b / 2.0 + Habs / 18.0 * (n * (a + b / 4.0 + e) - c / 2.0) * (32 + 79.0 / 21.0 * 28)) * (18 / PMComb) * I9;
  const FSO2 = e * (64 / PMComb) * I9;
  const FHollin = (1 - f1) * a * (12 / PMComb) * I9;
  return { FCO2, FCO, FO2, FN2, FH2O, FSO2, FHollin };
}


function perdidas_calor_sensible_v2(x, y, a, b, c, d, e, f1, n, PMComb, Habs, I9, I21) {
  const T1 = I21 + 273;
  const T2 = Tr + 273;
  const dT = I21 - Tr;

  const nCO2 = x;
  const nCO  = y;
  const nO2  = n * (a + b / 4 + e) - x - y / 2 - b / 4 - e;
  const nN2  = (79 / 21) * (n * (a + b / 4 + e) - c / 2) + d / 2;
  const nH2O = (b / 2) + (Habs / 18) * (n * (a + b / 4 + e) - c / 2) * (PMO2 + (79 / 21) * PMN2);
  const nSO2 = e;
  const nC   = (1 - f1) * a;

  const CPCO2 = 10.34 + 0.00137 * ((T1 * T1 - T2 * T2) / dT) - 195500 / (T1 * T2);
  const CPCO  = 6.6  + 0.0006  * ((T1 * T1 - T2 * T2) / dT);
  const CPO2  = 8.27 + 0.00129 * ((T1 * T1 - T2 * T2) / dT) - 187700 / (T1 * T2);
  const CPN2  = 6.5  + 0.0005  * ((T1 * T1 - T2 * T2) / dT);
  const CPH2O = 8.22 + 0.000075 * ((T1 * T1 - T2 * T2) / dT) + 44.67e-8 * ((T1 * T1 * T1 - T2 * T2 * T2) / dT);
  const CPSO2 = 7.7  + 0.00265  * ((T1 * T1 - T2 * T2) / dT) - 27.67e-8 * ((T1 * T1 * T1 - T2 * T2 * T2) / dT);
  const CPC   = 2.673 + 0.0013085 * ((T1 * T1 - T2 * T2) / (T1 - T2)) - 116900 / (T1 * T2);

  return (nCO2 * CPCO2 + nCO * CPCO + nO2 * CPO2 + nN2 * CPN2 + nH2O * CPH2O + nSO2 * CPSO2 + nC * CPC) * dT * I9 / PMComb;
}


function perdidas_inquemados_v2(FCO, DHCO_val, Pt, PCI, I9) {
  const Pig = FCO * DHCO_val;
  const Pis = Pt * PCI * I9 / 100 - Pig;
  return { Pig, Pis };
}


function calcula_calor_combustion(PCI, I9) {
  return PCI * I9;
}


function calcula_calor_sensible_combustible(I9, C1, C2, I10) {
  return I9 * (C1 + C2 * I10) * (I10 - Tr);
}


function calcula_calor_sensible_aire_seco(Habs, FOA, FNA, I11) {
  const T1 = I11 + 273;
  const T2 = Tr + 273;
  const dT = I11 - Tr;
  if (dT === 0) return 0;
  const CP_aire = 0.00636 + 0.000000845 * ((T1 * T1 - T2 * T2) / dT)
                - 0.000000000092 * ((T1 * T1 * T1 - T2 * T2 * T2) / dT);
  return Habs * (FOA + FNA) * CP_aire * dT * AIRE_PESO;
}


function calcula_calor_humedad_aire(FHA, I11) {
  return FHA * (1 + I11 / 10000) * (I11 - Tr);
}


function calcula_HL(I17) {
  return (0.00000000000657 * Math.pow(I17, 5) - 0.0000000133 * Math.pow(I17, 4) +
          0.0000103 * Math.pow(I17, 3) - 0.00393 * Math.pow(I17, 2) + 0.928 * I17 + 110);
}


function calcula_HV_saturado(I17) {
  return (-0.00000000000000887 * Math.pow(I17, 6) + 0.0000000000208 * Math.pow(I17, 5) -
          0.0000000193 * Math.pow(I17, 4) + 0.00000906 * Math.pow(I17, 3) -
          0.00236 * Math.pow(I17, 2) + 0.354 * I17 + 643);
}


function calcula_Cv(I18) {
  const T = I18 + 273;
  return (8.22 + 0.000075 * ((T * T - 273 * 273) / I18) +
          44.67e-8 * ((T * T * T - 273 * 273 * 273) / I18) + 1.987) / 18;
}


function calcula_Ts(I17) {
  return (Math.exp(0.22187 * Math.log(I17 + 14.7) + 4.7692) - 32) / 1.8;
}


function calcula_FC(I17, I18) {
  const P_normalizada = (I17 + 14.7) / 145.038;
  return ((-0.000000004475 * I18 * I18 + 0.000005271 * I18 - 0.002321) * P_normalizada * P_normalizada +
          (-0.0000000245 * I18 * I18 + 0.00002512 * I18 + 0.01171) * P_normalizada +
          (0.0000000925 * I18 * I18 - 0.0001796 * I18 + 1.02));
}


function calcula_HV_sobrecalentado(I17, I18) {
  const Cv = calcula_Cv(I18);
  const Ts = calcula_Ts(I17);
  const FC = calcula_FC(I17, I18);
  const HV_sat = calcula_HV_saturado(I17);
  return (HV_sat + Cv * (I18 - Ts)) * FC;
}


function calcula_HV(tipo_vapor, I17, I18) {
  if (tipo_vapor === 'Saturado') {
    return calcula_HV_saturado(I17);
  }
  return calcula_HV_sobrecalentado(I17, I18);
}


function calcula_area_y_perdidas(I4H, I5H, I13, I23, I24, I25, I26, I11) {
  const Af = (Math.PI / 4) * I4H * I4H;
  const Ad = Math.PI * I4H / 2 * I5H;
  const Ap = (Math.PI / 4) * I4H * I4H;
  const Ai = Math.PI * I4H / 2 * I5H;
  const Hc = 10.45 - I13 + 10 * Math.sqrt(I13);

  const Qcde = Af * Hc * (I23 - I11) * 3600 / 4.184 / 1000;
  const Qcld = Ad * Hc * (I24 - I11) * 3600 / 4.184 / 1000;
  const Qcpo = Ap * Hc * (I25 - I11) * 3600 / 4.184 / 1000;
  const Qcli = Ai * Hc * (I26 - I11) * 3600 / 4.184 / 1000;

  const Qrde = Af * EMISIVIDAD * SIGMA * (Math.pow(I23 + 273, 4) - Math.pow(I11 + 273, 4)) * 3600 / 4.184 / 1000;
  const Qrld = Ad * EMISIVIDAD * SIGMA * (Math.pow(I24 + 273, 4) - Math.pow(I11 + 273, 4)) * 3600 / 4.184 / 1000;
  const Qrpo = Ap * EMISIVIDAD * SIGMA * (Math.pow(I25 + 273, 4) - Math.pow(I11 + 273, 4)) * 3600 / 4.184 / 1000;
  const Qrli = Ai * EMISIVIDAD * SIGMA * (Math.pow(I26 + 273, 4) - Math.pow(I11 + 273, 4)) * 3600 / 4.184 / 1000;

  return (Qrde + Qcde) + (Qrld + Qcld) + (Qrpo + Qcpo) + (Qrli + Qcli);
}


const FT2_TO_M2 = 0.092903;

function clasifica_pt(pt) {
  if (pt < 0.25)  return 'Excelente';
  if (pt < 0.7)   return 'Muy buena';
  if (pt < 1.55)  return 'Buena';
  if (pt < 2.55)  return 'Aceptable';
  if (pt < 3.75)  return 'Pobre';
  if (pt < 5.3)   return 'Deficiente';
  if (pt < 7)     return 'Muy deficiente';
  if (pt < 8.95)  return 'Critica';
  if (pt < 11)    return 'Peligrosa';
  return 'Muy peligrosa';
}

function calcula_rocio_acido_excel(n_so3, n_h2o_comb, n_total) {
  if (n_so3 <= 0 || n_h2o_comb <= 0 || n_total <= 0) return 777;
  const ratio_h2o = n_h2o_comb / n_total;
  const ratio_so3 = n_so3 / n_total;
  return (203.25
          + 27.6  * Math.log10(ratio_h2o)
          + 10.83 * Math.log10(ratio_so3)
          + 1.06  * Math.pow(Math.log10(ratio_so3 + 8.0), 2.19));
}

function calcula_ratios(R21, R22, R26, R27, R29, I36) {
  const r42 = (R21 / R29) * 1000000;
  const r43 = (R22 / R29) * 1000000;
  const r44 = (R27 / R29) * 1000000;
  const r45 = (R26 / R29) * 1000000;
  const r46 = (R21 * I36) / 1000;
  const r47 = (R22 * I36) / 1000;
  const r48 = (R27 * I36) / 1000;
  const r49 = (R26 * I36) / 1000;
  return { r42, r43, r44, r45, r46, r47, r48, r49 };
}


/**
 * Función principal de cálculo.
 * @param {string} tipo_combustible - Nombre del combustible (clave de COMBUSTIBLES)
 * @param {string} tipo_vapor - "Saturado" | "Sobrecalentado"
 * @param {object} inputs - Objeto con todos los inputs I##
 * @returns {object} Resultados con claves R##
 */
function calcular(tipo_combustible, tipo_vapor, inputs) {
  const p = COMBUSTIBLES[tipo_combustible];
  if (!p) {
    throw new Error(`Combustible '${tipo_combustible}' no reconocido. Opciones: ${Object.keys(COMBUSTIBLES).join(', ')}`);
  }

  const PCI = p.PCI;
  const C1  = p.C1;
  const C2  = p.C2;
  const C_pct = p.C;

  const { I9, I10, I11, I12, I13, I14, I15, I16, I17, I18,
          I19, I20, I21, I22, I23, I24, I25, I26,
          I35, I36, I37, I38, I39, I40, I41, I42 } = inputs;
  const I2 = inputs.I2 || null;
  const I3 = inputs.I3 || null;

  const { a, b, c, d, e, PMComb } = calcula_balance_materia(tipo_combustible);
  const Habs = calcula_humedad(I11, I12);
  const Pt   = calcula_perdidas(I22, I20);

  const { f: f_conv, n, y, x } = bucle_conversion(a, b, c, d, e, PMComb, I9, PCI, Pt, I19, I20, C_pct);

  const { FOA, FNA, FHA, FTA } = calcula_flujos_aire(a, b, c, e, PMComb, I9, Habs, n);

  const chim = flujos_chimenea(a, b, c, d, e, PMComb, I9, n, y, x, Habs, f_conv);
  const R21 = chim.FCO2;
  const R22 = chim.FCO;
  const R23 = chim.FO2;
  const R24 = chim.FN2;
  const R25 = chim.FH2O;
  const R26 = chim.FSO2;
  const R27 = chim.FHollin;

  const R36 = perdidas_calor_sensible_v2(x, y, a, b, c, d, e, f_conv, n, PMComb, Habs, I9, I21);
  const { Pig, Pis } = perdidas_inquemados_v2(R22, DHCO, Pt, PCI, I9);
  const R38 = Pig;  // inquemados gaseosos
  const R37 = Pis;  // inquemados sólidos

  let R39;
  const I4H = inputs.I4H;
  const I5H = inputs.I5H;
  if (I4H && I5H) {
    R39 = calcula_area_y_perdidas(I4H, I5H, I13, I23, I24, I25, I26, I11);
  } else {
    R39 = 777;
  }

  const R29 = calcula_calor_combustion(PCI, I9);
  const R30 = calcula_calor_sensible_combustible(I9, C1, C2, I10);
  const R31 = calcula_calor_sensible_aire_seco(Habs, FOA, FNA, I11);
  const R32 = calcula_calor_humedad_aire(FHA, I11);

  const HLw  = (1 + I14 / 10000) * (I14 - Tr);
  const B240 = calcula_HL(I17);
  const B235 = calcula_HV(tipo_vapor, I17, I18);

  const denom = HLw + (I15 / (I16 - I15)) * (HLw - B240) - B235;
  const R19 = (R36 + R37 + R38 + (R39 !== 777 ? R39 : 0) - R29 - R30 - R31 - R32) / denom;
  const R20 = (I15 / (I16 - I15)) * R19;
  const R16 = R19 + R20;
  const R33 = R16 * HLw;
  const R35 = R19 * B235;
  const R40 = R20 * B240;

  const R15 = I9;
  const R17 = FTA;
  const R18 = R15 + R16 + R17;

  // Cierre de balance de masa (residuo en nitrógeno inerte)
  let R24_adj = R24;
  const mass_outputs = R19 + R20 + R21 + R22 + R23 + R24 + R25 + R26 + R27;
  const mass_closure_error = R18 - mass_outputs;
  if (Math.abs(mass_closure_error) < 0.5) { R24_adj += mass_closure_error; }

  const R28 = R19 + R20 + R21 + R22 + R23 + R24_adj + R25 + R26 + R27;
  const R34 = R29 + R30 + R31 + R32 + R33;
  const R41 = R35 + R36 + R37 + R38 + (R39 !== 777 ? R39 : 0) + R40;

  // Costos
  const r8 = 100 - (I37 + I38 + I39 + I40 + I41 + I42);
  const r7 = (R19 * r8 !== 0) ? (0.397 * I35 * R29) / (R19 * r8) : 777;

  // Ratios / Emisiones
  const ratios = calcula_ratios(R21, R22, R26, R27, R29, I36);

  // COM
  const R1A = clasifica_pt(Pt);
  const R1B = (n - 1) * 100;
  const R1C = (R17 !== 0 && R15 !== 0) ? R17 / R15 : 777;
  const R2B = R29 !== 0 ? (R37 / R29) * 100 : 777;
  const R2C = R29 !== 0 ? (R38 / R29) * 100 : 777;

  // PRO
  const R5_val = (B235 - HLw) / 470;
  const capacidad_produccion = (I2 && I2 !== 0 && R5_val !== 777) ? I2 * R5_val : 777;
  const R4_val = (capacidad_produccion !== 777 && capacidad_produccion !== 0) ? (R19 / capacidad_produccion) * 100 : 777;
  const R6A_val = R19 !== 0 ? R29 / R19 : 777;
  const superficie_m2 = (I3 && I3 !== 0) ? I3 * FT2_TO_M2 : 777;
  const R6B_val = (superficie_m2 !== 777 && superficie_m2 !== 0) ? R19 / superficie_m2 : 777;

  // R50 – Temperatura de rocío ácido (fórmula Excel)
  const n_h2o_comb_moles = b / 2.0;
  const n_h2o_air_moles = (Habs / 18.0) * (n * (a + b / 4.0 + e) - c / 2.0) * (PMO2 + (79.0 / 21.0) * PMN2);
  const n_h2o_moles = n_h2o_comb_moles + n_h2o_air_moles;
  const n_total_moles = x + y
    + (n * (a + b / 4.0 + e) - x - y / 2.0 - b / 4.0 - e)
    + ((79.0 / 21.0) * (n * (a + b / 4.0 + e) - c / 2.0) + d / 2.0)
    + n_h2o_moles + e + ((1 - f_conv) * a);
  const R50_val = calcula_rocio_acido_excel(e, n_h2o_comb_moles, n_total_moles);

  const rd = (v) => Math.round(v * 100) / 100;

  return {
    // BMS – Entradas
    R15: rd(R15),
    R16: rd(R16),
    R17: rd(R17),
    R18: rd(R18),
    // BMS – Salidas
    R19: rd(R19),
    R20: rd(R20),
    R21: rd(R21),
    R22: rd(R22),
    R23: rd(R23),
    R24: rd(R24_adj),
    R25: rd(R25),
    R26: rd(R26),
    R27: rd(R27),
    R28: rd(R28),
    // BEN – Entradas
    R29: rd(R29),
    R30: rd(R30),
    R31: rd(R31),
    R32: rd(R32),
    R33: rd(R33),
    R34: rd(R34),
    // BEN – Salidas
    R35: rd(R35),
    R36: rd(R36),
    R37: rd(R37),
    R38: rd(R38),
    R39: R39 !== 777 ? rd(R39) : 777,
    R40: rd(R40),
    R41: rd(R41),
    // COM
    R1A: R1A,
    R1B: rd(R1B),
    R1C: R1C !== 777 ? rd(R1C) : 777,
    R2A: rd(f_conv * 100),
    R2B: R2B !== 777 ? rd(R2B) : 777,
    R2C: R2C !== 777 ? rd(R2C) : 777,
    R3:  777,
    // PRO
    R4:  R4_val !== 777 ? Math.round(R4_val * 10) / 10 : 777,
    R5:  rd(R5_val),
    R19_pro: Math.round(R19 * 10) / 10,
    R6A: R6A_val !== 777 ? Math.round(R6A_val) : 777,
    R6B: R6B_val !== 777 ? Math.round(R6B_val) : 777,
    R7:  rd(r7),
    R8:  rd(r8),
    // EFI
    R9:  rd(R35 - R33),
    R10: rd(R36 - R30 - R31 - R32),
    R11: rd(R37 + R38),
    R12: R39 !== 777 ? rd(R39) : 777,
    R13: rd(R40),
    R14: rd(R29),
    r8:  rd(r8),
    // EMI
    R42: rd(ratios.r42),
    R43: rd(ratios.r43),
    R44: rd(ratios.r44),
    R45: rd(ratios.r45),
    R46: rd(ratios.r46),
    R47: rd(ratios.r47),
    R48: rd(ratios.r48),
    R49: rd(ratios.r49),
    R50: R50_val !== 777 ? rd(R50_val) : 777,
    // Auxiliares
    HABS: parseFloat(Habs.toFixed(6)),
    PT:   parseFloat(Pt.toFixed(4)),
    f:    parseFloat(f_conv.toFixed(6)),
    n:    parseFloat(n.toFixed(6)),
    y:    parseFloat(y.toFixed(6)),
    x:    parseFloat(x.toFixed(6)),
    HLw:  parseFloat(HLw.toFixed(6)),
    B235: parseFloat(B235.toFixed(4)),
    B240: parseFloat(B240.toFixed(4)),
  };
}


module.exports = { calcular, COMBUSTIBLES };
