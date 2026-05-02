"""
Seed script: populate countries, states, and cities tables.

Usage (from backend/ directory):
    python scripts/seed_locations.py

Run AFTER: alembic upgrade head
"""
import asyncio
import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.core.config import settings

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

COUNTRIES = [
    {"code": "IN", "name": "India", "state_label": "State / UT", "postal_label": "PIN Code", "sort_order": 1},
    {"code": "US", "name": "United States", "state_label": "State", "postal_label": "ZIP Code", "sort_order": 2},
    {"code": "AE", "name": "United Arab Emirates", "state_label": "Emirate", "postal_label": "Postal Code", "sort_order": 3},
    {"code": "GB", "name": "United Kingdom", "state_label": "Country / Region", "postal_label": "Postcode", "sort_order": 4},
    {"code": "CA", "name": "Canada", "state_label": "Province / Territory", "postal_label": "Postal Code", "sort_order": 5},
    {"code": "AU", "name": "Australia", "state_label": "State / Territory", "postal_label": "Postcode", "sort_order": 6},
    {"code": "SA", "name": "Saudi Arabia", "state_label": "Region", "postal_label": "Postal Code", "sort_order": 7},
    {"code": "PK", "name": "Pakistan", "state_label": "Province / Territory", "postal_label": "Postal Code", "sort_order": 8},
    {"code": "DE", "name": "Germany", "state_label": "State (Bundesland)", "postal_label": "Postal Code", "sort_order": 9},
    {"code": "BR", "name": "Brazil", "state_label": "State", "postal_label": "CEP", "sort_order": 10},
    {"code": "MX", "name": "Mexico", "state_label": "State", "postal_label": "Postal Code", "sort_order": 11},
    {"code": "FR", "name": "France", "state_label": "Region", "postal_label": "Postal Code", "sort_order": 12},
    {"code": "IT", "name": "Italy", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 13},
    {"code": "ES", "name": "Spain", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 14},
    {"code": "NL", "name": "Netherlands", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 15},
    {"code": "BE", "name": "Belgium", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 16},
    {"code": "CH", "name": "Switzerland", "state_label": "Canton", "postal_label": "Postal Code", "sort_order": 17},
    {"code": "SE", "name": "Sweden", "state_label": "County", "postal_label": "Postal Code", "sort_order": 18},
    {"code": "NO", "name": "Norway", "state_label": "County", "postal_label": "Postal Code", "sort_order": 19},
    {"code": "DK", "name": "Denmark", "state_label": "Region", "postal_label": "Postal Code", "sort_order": 20},
    {"code": "SG", "name": "Singapore", "state_label": "Region", "postal_label": "Postal Code", "sort_order": 21},
    {"code": "MY", "name": "Malaysia", "state_label": "State", "postal_label": "Postal Code", "sort_order": 22},
    {"code": "BD", "name": "Bangladesh", "state_label": "Division", "postal_label": "Postal Code", "sort_order": 23},
    {"code": "LK", "name": "Sri Lanka", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 24},
    {"code": "NG", "name": "Nigeria", "state_label": "State", "postal_label": "Postal Code", "sort_order": 25},
    {"code": "KE", "name": "Kenya", "state_label": "County", "postal_label": "Postal Code", "sort_order": 26},
    {"code": "ZA", "name": "South Africa", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 27},
    {"code": "EG", "name": "Egypt", "state_label": "Governorate", "postal_label": "Postal Code", "sort_order": 28},
    {"code": "TR", "name": "Turkey", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 29},
    {"code": "JP", "name": "Japan", "state_label": "Prefecture", "postal_label": "Postal Code", "sort_order": 30},
    {"code": "CN", "name": "China", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 31},
    {"code": "NZ", "name": "New Zealand", "state_label": "Region", "postal_label": "Postcode", "sort_order": 32},
    {"code": "PH", "name": "Philippines", "state_label": "Province", "postal_label": "Postal Code", "sort_order": 33},
    {"code": "GH", "name": "Ghana", "state_label": "Region", "postal_label": "Postal Code", "sort_order": 34},
    {"code": "ET", "name": "Ethiopia", "state_label": "Region", "postal_label": "Postal Code", "sort_order": 35},
    {"code": "TZ", "name": "Tanzania", "state_label": "Region", "postal_label": "Postal Code", "sort_order": 36},
    {"code": "QA", "name": "Qatar", "state_label": "Municipality", "postal_label": "Postal Code", "sort_order": 37},
    {"code": "KW", "name": "Kuwait", "state_label": "Governorate", "postal_label": "Postal Code", "sort_order": 38},
    {"code": "BH", "name": "Bahrain", "state_label": "Governorate", "postal_label": "Postal Code", "sort_order": 39},
    {"code": "OM", "name": "Oman", "state_label": "Governorate", "postal_label": "Postal Code", "sort_order": 40},
    {"code": "JO", "name": "Jordan", "state_label": "Governorate", "postal_label": "Postal Code", "sort_order": 41},
    {"code": "LB", "name": "Lebanon", "state_label": "Governorate", "postal_label": "Postal Code", "sort_order": 42},
]

# States keyed by country_code. Only countries with known state lists.
STATES = {
    "IN": [
        ("AN", "Andaman and Nicobar Islands"), ("AP", "Andhra Pradesh"), ("AR", "Arunachal Pradesh"),
        ("AS", "Assam"), ("BR", "Bihar"), ("CH", "Chandigarh"), ("CT", "Chhattisgarh"),
        ("DN", "Dadra and Nagar Haveli and Daman and Diu"), ("DL", "Delhi"), ("GA", "Goa"),
        ("GJ", "Gujarat"), ("HR", "Haryana"), ("HP", "Himachal Pradesh"),
        ("JK", "Jammu and Kashmir"), ("JH", "Jharkhand"), ("KA", "Karnataka"),
        ("KL", "Kerala"), ("LA", "Ladakh"), ("LD", "Lakshadweep"), ("MP", "Madhya Pradesh"),
        ("MH", "Maharashtra"), ("MN", "Manipur"), ("ML", "Meghalaya"), ("MZ", "Mizoram"),
        ("NL", "Nagaland"), ("OR", "Odisha"), ("PY", "Puducherry"), ("PB", "Punjab"),
        ("RJ", "Rajasthan"), ("SK", "Sikkim"), ("TN", "Tamil Nadu"), ("TS", "Telangana"),
        ("TR", "Tripura"), ("UP", "Uttar Pradesh"), ("UT", "Uttarakhand"), ("WB", "West Bengal"),
    ],
    "US": [
        ("AL", "Alabama"), ("AK", "Alaska"), ("AZ", "Arizona"), ("AR", "Arkansas"),
        ("CA", "California"), ("CO", "Colorado"), ("CT", "Connecticut"), ("DE", "Delaware"),
        ("DC", "District of Columbia"), ("FL", "Florida"), ("GA", "Georgia"), ("HI", "Hawaii"),
        ("ID", "Idaho"), ("IL", "Illinois"), ("IN", "Indiana"), ("IA", "Iowa"),
        ("KS", "Kansas"), ("KY", "Kentucky"), ("LA", "Louisiana"), ("ME", "Maine"),
        ("MD", "Maryland"), ("MA", "Massachusetts"), ("MI", "Michigan"), ("MN", "Minnesota"),
        ("MS", "Mississippi"), ("MO", "Missouri"), ("MT", "Montana"), ("NE", "Nebraska"),
        ("NV", "Nevada"), ("NH", "New Hampshire"), ("NJ", "New Jersey"), ("NM", "New Mexico"),
        ("NY", "New York"), ("NC", "North Carolina"), ("ND", "North Dakota"), ("OH", "Ohio"),
        ("OK", "Oklahoma"), ("OR", "Oregon"), ("PA", "Pennsylvania"), ("RI", "Rhode Island"),
        ("SC", "South Carolina"), ("SD", "South Dakota"), ("TN", "Tennessee"), ("TX", "Texas"),
        ("UT", "Utah"), ("VT", "Vermont"), ("VA", "Virginia"), ("WA", "Washington"),
        ("WV", "West Virginia"), ("WI", "Wisconsin"), ("WY", "Wyoming"),
        ("AS", "American Samoa"), ("GU", "Guam"), ("PR", "Puerto Rico"), ("VI", "U.S. Virgin Islands"),
    ],
    "CA": [
        ("AB", "Alberta"), ("BC", "British Columbia"), ("MB", "Manitoba"),
        ("NB", "New Brunswick"), ("NL", "Newfoundland and Labrador"), ("NS", "Nova Scotia"),
        ("NT", "Northwest Territories"), ("NU", "Nunavut"), ("ON", "Ontario"),
        ("PE", "Prince Edward Island"), ("QC", "Quebec"), ("SK", "Saskatchewan"), ("YT", "Yukon"),
    ],
    "GB": [
        ("ENG", "England"), ("SCT", "Scotland"), ("WLS", "Wales"), ("NIR", "Northern Ireland"),
    ],
    "AU": [
        ("ACT", "Australian Capital Territory"), ("NSW", "New South Wales"),
        ("NT", "Northern Territory"), ("QLD", "Queensland"), ("SA", "South Australia"),
        ("TAS", "Tasmania"), ("VIC", "Victoria"), ("WA", "Western Australia"),
    ],
    "AE": [
        ("AZ", "Abu Dhabi"), ("AJ", "Ajman"), ("DU", "Dubai"), ("FU", "Fujairah"),
        ("RK", "Ras Al Khaimah"), ("SH", "Sharjah"), ("UQ", "Umm Al Quwain"),
    ],
    "SA": [
        ("01", "Riyadh"), ("02", "Makkah"), ("03", "Madinah"), ("04", "Eastern Province"),
        ("05", "Al-Qassim"), ("06", "Ha'il"), ("07", "Tabuk"), ("08", "Northern Borders"),
        ("09", "Jazan"), ("10", "Najran"), ("11", "Al Bahah"), ("12", "Al Jawf"), ("13", "Asir"),
    ],
    "DE": [
        ("BW", "Baden-Württemberg"), ("BY", "Bavaria"), ("BE", "Berlin"), ("BB", "Brandenburg"),
        ("HB", "Bremen"), ("HH", "Hamburg"), ("HE", "Hesse"), ("MV", "Mecklenburg-Vorpommern"),
        ("NI", "Lower Saxony"), ("NW", "North Rhine-Westphalia"), ("RP", "Rhineland-Palatinate"),
        ("SL", "Saarland"), ("SN", "Saxony"), ("ST", "Saxony-Anhalt"),
        ("SH", "Schleswig-Holstein"), ("TH", "Thuringia"),
    ],
    "PK": [
        ("BAL", "Balochistan"), ("GB", "Gilgit-Baltistan"), ("AJK", "Azad Jammu & Kashmir"),
        ("KP", "Khyber Pakhtunkhwa"), ("PB", "Punjab"), ("SD", "Sindh"),
        ("ICT", "Islamabad Capital Territory"),
    ],
    "BR": [
        ("AC", "Acre"), ("AL", "Alagoas"), ("AP", "Amapá"), ("AM", "Amazonas"),
        ("BA", "Bahia"), ("CE", "Ceará"), ("DF", "Distrito Federal"), ("ES", "Espírito Santo"),
        ("GO", "Goiás"), ("MA", "Maranhão"), ("MT", "Mato Grosso"), ("MS", "Mato Grosso do Sul"),
        ("MG", "Minas Gerais"), ("PA", "Pará"), ("PB", "Paraíba"), ("PR", "Paraná"),
        ("PE", "Pernambuco"), ("PI", "Piauí"), ("RJ", "Rio de Janeiro"),
        ("RN", "Rio Grande do Norte"), ("RS", "Rio Grande do Sul"), ("RO", "Rondônia"),
        ("RR", "Roraima"), ("SC", "Santa Catarina"), ("SP", "São Paulo"),
        ("SE", "Sergipe"), ("TO", "Tocantins"),
    ],
    "MX": [
        ("AGU", "Aguascalientes"), ("BCN", "Baja California"), ("BCS", "Baja California Sur"),
        ("CAM", "Campeche"), ("CHP", "Chiapas"), ("CHH", "Chihuahua"), ("CMX", "Mexico City"),
        ("COA", "Coahuila"), ("COL", "Colima"), ("DUR", "Durango"), ("GUA", "Guanajuato"),
        ("GRO", "Guerrero"), ("HID", "Hidalgo"), ("JAL", "Jalisco"), ("MEX", "México"),
        ("MIC", "Michoacán"), ("MOR", "Morelos"), ("NAY", "Nayarit"), ("NLE", "Nuevo León"),
        ("OAX", "Oaxaca"), ("PUE", "Puebla"), ("QUE", "Querétaro"), ("ROO", "Quintana Roo"),
        ("SLP", "San Luis Potosí"), ("SIN", "Sinaloa"), ("SON", "Sonora"), ("TAB", "Tabasco"),
        ("TAM", "Tamaulipas"), ("TLA", "Tlaxcala"), ("VER", "Veracruz"),
        ("YUC", "Yucatán"), ("ZAC", "Zacatecas"),
    ],
}

# Major cities keyed by (country_code, state_code)
CITIES = {
    # India — Maharashtra
    ("IN", "MH"): [
        "Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur",
        "Kolhapur", "Amravati", "Nanded", "Sangli", "Jalgaon", "Akola", "Latur", "Dhule",
    ],
    # India — Delhi
    ("IN", "DL"): ["New Delhi", "Delhi"],
    # India — Karnataka
    ("IN", "KA"): [
        "Bengaluru", "Mysuru", "Hubli", "Mangaluru", "Belagavi", "Davanagere",
        "Ballari", "Vijayapura", "Shivamogga", "Tumakuru",
    ],
    # India — Tamil Nadu
    ("IN", "TN"): [
        "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli",
        "Tiruppur", "Vellore", "Erode", "Thanjavur",
    ],
    # India — Telangana
    ("IN", "TS"): ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Secunderabad"],
    # India — Gujarat
    ("IN", "GJ"): [
        "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar",
        "Gandhinagar", "Junagadh", "Anand", "Nadiad",
    ],
    # India — Rajasthan
    ("IN", "RJ"): [
        "Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur",
        "Bhilwara", "Alwar", "Bharatpur", "Sikar",
    ],
    # India — Uttar Pradesh
    ("IN", "UP"): [
        "Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut",
        "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Noida",
    ],
    # India — West Bengal
    ("IN", "WB"): [
        "Kolkata", "Asansol", "Siliguri", "Durgapur", "Bardhaman", "Malda",
        "Barasat", "Krishnanagar", "Howrah", "Medinipur",
    ],
    # India — Punjab
    ("IN", "PB"): [
        "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda",
        "Mohali", "Hoshiarpur", "Gurdaspur", "Pathankot", "Moga",
    ],
    # India — Haryana
    ("IN", "HR"): [
        "Faridabad", "Gurgaon", "Panipat", "Ambala", "Yamunanagar",
        "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula",
    ],
    # India — Andhra Pradesh
    ("IN", "AP"): [
        "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool",
        "Tirupati", "Kadapa", "Rajahmundry", "Kakinada", "Anantapur",
    ],
    # India — Kerala
    ("IN", "KL"): [
        "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam",
        "Palakkad", "Alappuzha", "Malappuram", "Kannur", "Kottayam",
    ],
    # India — Madhya Pradesh
    ("IN", "MP"): [
        "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain",
        "Sagar", "Dewas", "Satna", "Ratlam", "Rewa",
    ],
    # India — Bihar
    ("IN", "BR"): [
        "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia",
        "Darbhanga", "Bihar Sharif", "Arrah", "Begusarai", "Katihar",
    ],
    # India — Odisha
    ("IN", "OR"): [
        "Bhubaneswar", "Cuttack", "Rourkela", "Brahmapur", "Sambalpur",
        "Puri", "Balasore", "Bhadrak", "Baripada", "Jharsuguda",
    ],
    # India — Chandigarh
    ("IN", "CH"): ["Chandigarh"],
    # India — Goa
    ("IN", "GA"): ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
    # UAE — Dubai
    ("AE", "DU"): ["Dubai", "Deira", "Bur Dubai", "Jumeirah", "Marina"],
    # UAE — Abu Dhabi
    ("AE", "AZ"): ["Abu Dhabi", "Al Ain", "Khalifa City", "Mussafah"],
    # UAE — Sharjah
    ("AE", "SH"): ["Sharjah", "Khor Fakkan", "Kalba"],
    # US — California
    ("US", "CA"): [
        "Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento",
        "Fresno", "Long Beach", "Oakland", "Bakersfield", "Anaheim",
    ],
    # US — New York
    ("US", "NY"): [
        "New York City", "Buffalo", "Rochester", "Yonkers", "Syracuse",
        "Albany", "New Rochelle", "Mount Vernon", "Schenectady", "Utica",
    ],
    # US — Texas
    ("US", "TX"): [
        "Houston", "San Antonio", "Dallas", "Austin", "Fort Worth",
        "El Paso", "Arlington", "Corpus Christi", "Plano", "Laredo",
    ],
    # US — Florida
    ("US", "FL"): [
        "Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg",
        "Hialeah", "Tallahassee", "Fort Lauderdale", "Port St. Lucie", "Cape Coral",
    ],
    # GB — England
    ("GB", "ENG"): [
        "London", "Birmingham", "Leeds", "Sheffield", "Bristol",
        "Manchester", "Leicester", "Coventry", "Bradford", "Nottingham",
    ],
    # GB — Scotland
    ("GB", "SCT"): ["Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Inverness"],
    # CA — Ontario
    ("CA", "ON"): ["Toronto", "Ottawa", "Mississauga", "Brampton", "Hamilton", "London"],
    # CA — British Columbia
    ("CA", "BC"): ["Vancouver", "Surrey", "Burnaby", "Richmond", "Kelowna"],
    # AU — New South Wales
    ("AU", "NSW"): ["Sydney", "Newcastle", "Wollongong", "Maitland", "Coffs Harbour"],
    # AU — Victoria
    ("AU", "VIC"): ["Melbourne", "Geelong", "Ballarat", "Bendigo", "Shepparton"],
    # SA — Riyadh
    ("SA", "01"): ["Riyadh", "Al Kharj", "Al Zulfi", "Dawadmi"],
    # SA — Makkah
    ("SA", "02"): ["Mecca", "Jeddah", "Taif"],
    # PK — Punjab
    ("PK", "PB"): ["Lahore", "Faisalabad", "Rawalpindi", "Gujranwala", "Multan", "Sialkot"],
    # PK — Sindh
    ("PK", "SD"): ["Karachi", "Hyderabad", "Sukkur", "Larkana", "Nawabshah"],
}


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------

async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    now = datetime.now(timezone.utc)

    async with async_session() as session:
        # Check if already seeded
        result = await session.execute(text("SELECT COUNT(*) FROM countries"))
        count = result.scalar()
        if count > 0:
            print(f"Countries table already has {count} rows — skipping seed.")
            return

        print("Seeding countries...")
        for c in COUNTRIES:
            await session.execute(text("""
                INSERT INTO countries (code, name, state_label, postal_label, is_active, sort_order, created_at, updated_at)
                VALUES (:code, :name, :state_label, :postal_label, true, :sort_order, :now, :now)
                ON CONFLICT (code) DO NOTHING
            """), {**c, "now": now})

        print("Seeding states...")
        # Build a map of (country_code, state_code) → state_id for cities
        state_id_map: dict[tuple, str] = {}
        for country_code, state_list in STATES.items():
            for i, (code, name) in enumerate(state_list):
                sid = str(uuid.uuid4())
                state_id_map[(country_code, code)] = sid
                await session.execute(text("""
                    INSERT INTO states (id, country_code, code, name, is_active, sort_order, created_at, updated_at)
                    VALUES (:id, :country_code, :code, :name, true, :sort_order, :now, :now)
                    ON CONFLICT (country_code, code) DO NOTHING
                """), {"id": sid, "country_code": country_code, "code": code, "name": name, "sort_order": i, "now": now})

        print("Seeding cities...")
        for (country_code, state_code), city_names in CITIES.items():
            state_id = state_id_map.get((country_code, state_code))
            if not state_id:
                print(f"  WARNING: no state_id for ({country_code}, {state_code}) — skipping cities")
                continue
            for i, city_name in enumerate(city_names):
                await session.execute(text("""
                    INSERT INTO cities (id, state_id, country_code, name, is_active, sort_order, created_at, updated_at)
                    VALUES (:id, :state_id, :country_code, :name, true, :sort_order, :now, :now)
                """), {
                    "id": str(uuid.uuid4()),
                    "state_id": state_id,
                    "country_code": country_code,
                    "name": city_name,
                    "sort_order": i,
                    "now": now,
                })

        await session.commit()
        print("✓ Location data seeded successfully.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
