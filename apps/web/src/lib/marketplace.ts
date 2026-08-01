export const CATEGORIAS = [
  "Moda y Ropa",
  "Electronica",
  "Calzado",
  "Joyas y Relojes",
  "Hogar",
  "Colecciones",
  "Barajitas y Memorabilia",
  "Antigüedades",
  "Arte",
  "Autos y Motos",
  "Bebés",
  "Belleza y Cuidado Personal",
  "Comida",
  "Computación",
  "Consolas y Videojuegos",
  "Deportes",
  "Electrodomésticos",
  "Fotografía y Video",
  "Herramientas",
  "Instrumentos Musicales",
  "Juguetes",
  "Libros y Revistas",
  "Mascotas",
  "Muebles y Decoración",
  "Telefonía",
  "Otros",
] as const;

export const CIUDADES_VENEZUELA = [
  "Acarigua",
  "Anaco",
  "Barcelona",
  "Barinas",
  "Barquisimeto",
  "Cabimas",
  "Cagua",
  "Calabozo",
  "Caracas",
  "Carora",
  "Carúpano",
  "Catia La Mar",
  "Ciudad Bolívar",
  "Ciudad Guayana (Puerto Ordaz / San Félix)",
  "Coro",
  "Cumaná",
  "El Tigre",
  "El Vigía",
  "Guanare",
  "Guacara",
  "Guarenas",
  "Guatire",
  "La Asunción",
  "La Guaira",
  "Los Teques",
  "Machiques",
  "Maracaibo",
  "Maracay",
  "Maturín",
  "Mérida",
  "Ocumare del Tuy",
  "Porlamar",
  "Puerto Ayacucho",
  "Puerto Cabello",
  "Puerto La Cruz",
  "Punto Fijo",
  "San Carlos",
  "San Cristóbal",
  "San Felipe",
  "San Fernando de Apure",
  "Santa Teresa del Tuy",
  "Trujillo",
  "Tucupita",
  "Turmero",
  "Upata",
  "Valencia",
  "Valera",
  "Valle de la Pascua",
] as const;

export function formatearCedulaVenezolana(valor: string): string {
  return `V-${valor.replace(/\D/g, "").slice(0, 9)}`;
}

export function formatearTelefonoVenezolano(valor: string): string {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.startsWith("58")) digitos = digitos.slice(2);
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  return `+58${digitos ? ` ${digitos.slice(0, 10)}` : ""}`;
}

export function telefonoVenezolanoValido(valor: string): boolean {
  return valor.replace(/\D/g, "").replace(/^58/, "").replace(/^0/, "").length === 10;
}

export function cedulaVenezolanaValida(valor: string): boolean {
  return /^V-\d{6,9}$/.test(valor);
}
