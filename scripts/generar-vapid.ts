import webpush from "web-push";

// Genera el par de llaves VAPID que pide Web Push. Correr una sola vez y
// guardar el resultado en .env; si cambian, las suscripciones existentes mueren.
const llaves = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY="${llaves.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${llaves.privateKey}"`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${llaves.publicKey}"`);
