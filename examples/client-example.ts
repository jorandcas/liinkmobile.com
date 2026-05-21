import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

/**
 * Ejemplo de validación individual
 */
async function ejemploValidacionIndividual() {
  try {
    const response = await axios.post(`${API_URL}/validate/single`, {
      telefono: '9233250673',
      verificarEn: ['PROD']
    });

    console.log('✅ Validación individual exitosa:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Error en validación individual:', error);
  }
}

/**
 * Ejemplo de validación en múltiples ambientes simultáneos
 */
async function ejemploValidacionSimultanea() {
  try {
    const response = await axios.post(`${API_URL}/validate/single`, {
      telefono: '9233250673',
      verificarEn: ['QA', 'PROD']
    });

    console.log('✅ Validación simultánea QA + PROD:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Error en validación simultánea:', error);
  }
}

/**
 * Ejemplo de validación por lotes
 */
async function ejemploValidacionLote() {
  try {
    const response = await axios.post(`${API_URL}/validate/batch`, {
      telefonos: ['9233250673', '9233250674', '9233250675'],
      verificarEn: ['PROD'],
      maxConcurrent: 3
    });

    console.log('✅ Validación por lotes exitosa:');
    console.log('Estadísticas:', response.data.datos.estadisticas);
    console.log('Resultados:', response.data.datos.resultados);
  } catch (error) {
    console.error('❌ Error en validación por lotes:', error);
  }
}

/**
 * Ejemplo de validación masiva con CSV
 */
async function ejemploValidacionMasiva() {
  const FormData = require('form-data');
  const fs = require('fs');

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream('./examples/telefonos.csv'));
    form.append('verificarEn', JSON.stringify(['PROD']));
    form.append('maxConcurrent', '10');

    const response = await axios.post(`${API_URL}/validate/bulk`, form, {
      headers: {
        ...form.getHeaders()
      }
    });

    console.log('✅ Validación masiva exitosa:');
    console.log('Total procesados:', response.data.datos.totalProcesados);
    console.log('Exitosos:', response.data.datos.exitosos);
    console.log('Fallidos:', response.data.datos.fallidos);
  } catch (error) {
    console.error('❌ Error en validación masiva:', error);
  }
}

/**
 * Ejecutar todos los ejemplos
 */
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   API DN Verification - Ejemplos        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log('1. Validación Individual');
  console.log('─────────────────────────────────────');
  await ejemploValidacionIndividual();
  console.log('');

  console.log('2. Validación Simultánea (QA + PROD)');
  console.log('─────────────────────────────────────');
  await ejemploValidacionSimultanea();
  console.log('');

  console.log('3. Validación por Lotes');
  console.log('─────────────────────────────────────');
  await ejemploValidacionLote();
  console.log('');

  console.log('4. Validación Masiva (CSV)');
  console.log('─────────────────────────────────────');
  await ejemploValidacionMasiva();
  console.log('');

  console.log('✓ Todos los ejemplos completados');
}

main().catch(console.error);
