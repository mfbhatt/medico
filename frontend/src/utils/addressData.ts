export interface StateProvince {
  code: string;
  name: string;
}

export interface Country {
  code: string;          // ISO 3166-1 alpha-2
  name: string;
  stateLabel: string;    // "State", "Province", "Emirate", etc.
  postalLabel: string;   // "ZIP Code", "Postal Code", "Pincode", etc.
  states: StateProvince[]; // empty → free-text state/region field
}

export const ALL_COUNTRIES: Country[] = [
  {
    code: "US", name: "United States", stateLabel: "State", postalLabel: "ZIP Code",
    states: [
      { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
      { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
      { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
      { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
      { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" },
      { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
      { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
      { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
      { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
      { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
      { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
      { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
      { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
      { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
      { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
      { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
      { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
      { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
      { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
      { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
      { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
      { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
      { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
      { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
      { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
      { code: "WY", name: "Wyoming" }, { code: "AS", name: "American Samoa" },
      { code: "GU", name: "Guam" }, { code: "PR", name: "Puerto Rico" },
      { code: "VI", name: "U.S. Virgin Islands" },
    ],
  },
  {
    code: "CA", name: "Canada", stateLabel: "Province / Territory", postalLabel: "Postal Code",
    states: [
      { code: "AB", name: "Alberta" }, { code: "BC", name: "British Columbia" },
      { code: "MB", name: "Manitoba" }, { code: "NB", name: "New Brunswick" },
      { code: "NL", name: "Newfoundland and Labrador" }, { code: "NS", name: "Nova Scotia" },
      { code: "NT", name: "Northwest Territories" }, { code: "NU", name: "Nunavut" },
      { code: "ON", name: "Ontario" }, { code: "PE", name: "Prince Edward Island" },
      { code: "QC", name: "Quebec" }, { code: "SK", name: "Saskatchewan" },
      { code: "YT", name: "Yukon" },
    ],
  },
  {
    code: "GB", name: "United Kingdom", stateLabel: "Country / Region", postalLabel: "Postcode",
    states: [
      { code: "ENG", name: "England" }, { code: "SCT", name: "Scotland" },
      { code: "WLS", name: "Wales" }, { code: "NIR", name: "Northern Ireland" },
    ],
  },
  {
    code: "AU", name: "Australia", stateLabel: "State / Territory", postalLabel: "Postcode",
    states: [
      { code: "ACT", name: "Australian Capital Territory" },
      { code: "NSW", name: "New South Wales" }, { code: "NT", name: "Northern Territory" },
      { code: "QLD", name: "Queensland" }, { code: "SA", name: "South Australia" },
      { code: "TAS", name: "Tasmania" }, { code: "VIC", name: "Victoria" },
      { code: "WA", name: "Western Australia" },
    ],
  },
  {
    code: "IN", name: "India", stateLabel: "State / UT", postalLabel: "PIN Code",
    states: [
      { code: "AN", name: "Andaman and Nicobar Islands" }, { code: "AP", name: "Andhra Pradesh" },
      { code: "AR", name: "Arunachal Pradesh" }, { code: "AS", name: "Assam" },
      { code: "BR", name: "Bihar" }, { code: "CH", name: "Chandigarh" },
      { code: "CT", name: "Chhattisgarh" }, { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu" },
      { code: "DL", name: "Delhi" }, { code: "GA", name: "Goa" },
      { code: "GJ", name: "Gujarat" }, { code: "HR", name: "Haryana" },
      { code: "HP", name: "Himachal Pradesh" }, { code: "JK", name: "Jammu and Kashmir" },
      { code: "JH", name: "Jharkhand" }, { code: "KA", name: "Karnataka" },
      { code: "KL", name: "Kerala" }, { code: "LA", name: "Ladakh" },
      { code: "LD", name: "Lakshadweep" }, { code: "MP", name: "Madhya Pradesh" },
      { code: "MH", name: "Maharashtra" }, { code: "MN", name: "Manipur" },
      { code: "ML", name: "Meghalaya" }, { code: "MZ", name: "Mizoram" },
      { code: "NL", name: "Nagaland" }, { code: "OR", name: "Odisha" },
      { code: "PY", name: "Puducherry" }, { code: "PB", name: "Punjab" },
      { code: "RJ", name: "Rajasthan" }, { code: "SK", name: "Sikkim" },
      { code: "TN", name: "Tamil Nadu" }, { code: "TS", name: "Telangana" },
      { code: "TR", name: "Tripura" }, { code: "UP", name: "Uttar Pradesh" },
      { code: "UT", name: "Uttarakhand" }, { code: "WB", name: "West Bengal" },
    ],
  },
  {
    code: "AE", name: "United Arab Emirates", stateLabel: "Emirate", postalLabel: "Postal Code",
    states: [
      { code: "AZ", name: "Abu Dhabi" }, { code: "AJ", name: "Ajman" },
      { code: "DU", name: "Dubai" }, { code: "FU", name: "Fujairah" },
      { code: "RK", name: "Ras Al Khaimah" }, { code: "SH", name: "Sharjah" },
      { code: "UQ", name: "Umm Al Quwain" },
    ],
  },
  {
    code: "SA", name: "Saudi Arabia", stateLabel: "Region", postalLabel: "Postal Code",
    states: [
      { code: "01", name: "Riyadh" }, { code: "02", name: "Makkah" },
      { code: "03", name: "Madinah" }, { code: "04", name: "Eastern Province" },
      { code: "05", name: "Al-Qassim" }, { code: "06", name: "Ha'il" },
      { code: "07", name: "Tabuk" }, { code: "08", name: "Northern Borders" },
      { code: "09", name: "Jazan" }, { code: "10", name: "Najran" },
      { code: "11", name: "Al Bahah" }, { code: "12", name: "Al Jawf" },
      { code: "13", name: "Asir" },
    ],
  },
  {
    code: "DE", name: "Germany", stateLabel: "State (Bundesland)", postalLabel: "Postal Code",
    states: [
      { code: "BW", name: "Baden-Württemberg" }, { code: "BY", name: "Bavaria" },
      { code: "BE", name: "Berlin" }, { code: "BB", name: "Brandenburg" },
      { code: "HB", name: "Bremen" }, { code: "HH", name: "Hamburg" },
      { code: "HE", name: "Hesse" }, { code: "MV", name: "Mecklenburg-Vorpommern" },
      { code: "NI", name: "Lower Saxony" }, { code: "NW", name: "North Rhine-Westphalia" },
      { code: "RP", name: "Rhineland-Palatinate" }, { code: "SL", name: "Saarland" },
      { code: "SN", name: "Saxony" }, { code: "ST", name: "Saxony-Anhalt" },
      { code: "SH", name: "Schleswig-Holstein" }, { code: "TH", name: "Thuringia" },
    ],
  },
  {
    code: "PK", name: "Pakistan", stateLabel: "Province / Territory", postalLabel: "Postal Code",
    states: [
      { code: "BAL", name: "Balochistan" }, { code: "GB", name: "Gilgit-Baltistan" },
      { code: "AJK", name: "Azad Jammu & Kashmir" }, { code: "KP", name: "Khyber Pakhtunkhwa" },
      { code: "PB", name: "Punjab" }, { code: "SD", name: "Sindh" },
      { code: "ICT", name: "Islamabad Capital Territory" },
    ],
  },
  {
    code: "BR", name: "Brazil", stateLabel: "State", postalLabel: "CEP",
    states: [
      { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" },
      { code: "AP", name: "Amapá" }, { code: "AM", name: "Amazonas" },
      { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceará" },
      { code: "DF", name: "Distrito Federal" }, { code: "ES", name: "Espírito Santo" },
      { code: "GO", name: "Goiás" }, { code: "MA", name: "Maranhão" },
      { code: "MT", name: "Mato Grosso" }, { code: "MS", name: "Mato Grosso do Sul" },
      { code: "MG", name: "Minas Gerais" }, { code: "PA", name: "Pará" },
      { code: "PB", name: "Paraíba" }, { code: "PR", name: "Paraná" },
      { code: "PE", name: "Pernambuco" }, { code: "PI", name: "Piauí" },
      { code: "RJ", name: "Rio de Janeiro" }, { code: "RN", name: "Rio Grande do Norte" },
      { code: "RS", name: "Rio Grande do Sul" }, { code: "RO", name: "Rondônia" },
      { code: "RR", name: "Roraima" }, { code: "SC", name: "Santa Catarina" },
      { code: "SP", name: "São Paulo" }, { code: "SE", name: "Sergipe" },
      { code: "TO", name: "Tocantins" },
    ],
  },
  {
    code: "MX", name: "Mexico", stateLabel: "State", postalLabel: "Postal Code",
    states: [
      { code: "AGU", name: "Aguascalientes" }, { code: "BCN", name: "Baja California" },
      { code: "BCS", name: "Baja California Sur" }, { code: "CAM", name: "Campeche" },
      { code: "CHP", name: "Chiapas" }, { code: "CHH", name: "Chihuahua" },
      { code: "CMX", name: "Mexico City" }, { code: "COA", name: "Coahuila" },
      { code: "COL", name: "Colima" }, { code: "DUR", name: "Durango" },
      { code: "GUA", name: "Guanajuato" }, { code: "GRO", name: "Guerrero" },
      { code: "HID", name: "Hidalgo" }, { code: "JAL", name: "Jalisco" },
      { code: "MEX", name: "México" }, { code: "MIC", name: "Michoacán" },
      { code: "MOR", name: "Morelos" }, { code: "NAY", name: "Nayarit" },
      { code: "NLE", name: "Nuevo León" }, { code: "OAX", name: "Oaxaca" },
      { code: "PUE", name: "Puebla" }, { code: "QUE", name: "Querétaro" },
      { code: "ROO", name: "Quintana Roo" }, { code: "SLP", name: "San Luis Potosí" },
      { code: "SIN", name: "Sinaloa" }, { code: "SON", name: "Sonora" },
      { code: "TAB", name: "Tabasco" }, { code: "TAM", name: "Tamaulipas" },
      { code: "TLA", name: "Tlaxcala" }, { code: "VER", name: "Veracruz" },
      { code: "YUC", name: "Yucatán" }, { code: "ZAC", name: "Zacatecas" },
    ],
  },
  // Countries without state dropdowns (free-text region field)
  { code: "FR", name: "France", stateLabel: "Region", postalLabel: "Postal Code", states: [] },
  { code: "IT", name: "Italy", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "ES", name: "Spain", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "NL", name: "Netherlands", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "BE", name: "Belgium", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "CH", name: "Switzerland", stateLabel: "Canton", postalLabel: "Postal Code", states: [] },
  { code: "SE", name: "Sweden", stateLabel: "County", postalLabel: "Postal Code", states: [] },
  { code: "NO", name: "Norway", stateLabel: "County", postalLabel: "Postal Code", states: [] },
  { code: "DK", name: "Denmark", stateLabel: "Region", postalLabel: "Postal Code", states: [] },
  { code: "SG", name: "Singapore", stateLabel: "Region", postalLabel: "Postal Code", states: [] },
  { code: "MY", name: "Malaysia", stateLabel: "State", postalLabel: "Postal Code", states: [] },
  { code: "BD", name: "Bangladesh", stateLabel: "Division", postalLabel: "Postal Code", states: [] },
  { code: "LK", name: "Sri Lanka", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "NG", name: "Nigeria", stateLabel: "State", postalLabel: "Postal Code", states: [] },
  { code: "KE", name: "Kenya", stateLabel: "County", postalLabel: "Postal Code", states: [] },
  { code: "ZA", name: "South Africa", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "EG", name: "Egypt", stateLabel: "Governorate", postalLabel: "Postal Code", states: [] },
  { code: "TR", name: "Turkey", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "JP", name: "Japan", stateLabel: "Prefecture", postalLabel: "Postal Code", states: [] },
  { code: "CN", name: "China", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "NZ", name: "New Zealand", stateLabel: "Region", postalLabel: "Postcode", states: [] },
  { code: "PH", name: "Philippines", stateLabel: "Province", postalLabel: "Postal Code", states: [] },
  { code: "GH", name: "Ghana", stateLabel: "Region", postalLabel: "Postal Code", states: [] },
  { code: "ET", name: "Ethiopia", stateLabel: "Region", postalLabel: "Postal Code", states: [] },
  { code: "TZ", name: "Tanzania", stateLabel: "Region", postalLabel: "Postal Code", states: [] },
  { code: "QA", name: "Qatar", stateLabel: "Municipality", postalLabel: "Postal Code", states: [] },
  { code: "KW", name: "Kuwait", stateLabel: "Governorate", postalLabel: "Postal Code", states: [] },
  { code: "BH", name: "Bahrain", stateLabel: "Governorate", postalLabel: "Postal Code", states: [] },
  { code: "OM", name: "Oman", stateLabel: "Governorate", postalLabel: "Postal Code", states: [] },
  { code: "JO", name: "Jordan", stateLabel: "Governorate", postalLabel: "Postal Code", states: [] },
  { code: "LB", name: "Lebanon", stateLabel: "Governorate", postalLabel: "Postal Code", states: [] },
];

export const COUNTRY_MAP = new Map<string, Country>(
  ALL_COUNTRIES.map((c) => [c.code, c])
);

/** Return the Country object for a given code, or undefined. */
export function getCountry(code: string): Country | undefined {
  return COUNTRY_MAP.get(code);
}
