"""
Seed script: 100 unique Greater Philadelphia area businesses with
distinct descriptions and locations.
"""

"""
$env:DATABASE_URL='your-connection-string'; $env:RESET_BUSINESSES='1'; python seed_philly_businesses.py
"""


import os
from datetime import datetime, timezone
from typing import List, Dict

import bcrypt
from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker

from app import models, models_user
from app.database import Base, build_engine, get_database_url

load_dotenv()


DATABASE_URL = get_database_url()
engine = build_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# 100 unique Greater Philadelphia businesses
BUSINESSES: List[Dict] = [
    # Center City
    {"name": "Market Street Coffee Lab", "description": "Espresso flights, rotating single origins, and commuter-friendly hours by City Hall.", "phone_number": "215-555-4101", "address1": "1201 Market St", "city": "Philadelphia", "state": "PA", "zip": "19107", "lat": 39.9529, "lng": -75.1622},
    {"name": "City Hall Terrace Bistro", "description": "Lunch counter with skyline views, salads, and pressed sandwiches.", "phone_number": "215-555-4102", "address1": "1400 JFK Blvd", "city": "Philadelphia", "state": "PA", "zip": "19107", "lat": 39.9538, "lng": -75.1649},

    # Fishtown
    {"name": "Fishtown Vinyl & Brews", "description": "Listening bar with local beer taps and crate-digging nights.", "phone_number": "267-555-4103", "address1": "1438 Frankford Ave", "city": "Philadelphia", "state": "PA", "zip": "19125", "lat": 39.972, "lng": -75.133},
    {"name": "River Wards Bagel Co.", "description": "Wood-fired bagels, smoked fish plates, and backyard picnic tables.", "phone_number": "267-555-4104", "address1": "1101 E Berks St", "city": "Philadelphia", "state": "PA", "zip": "19125", "lat": 39.975, "lng": -75.131},

    # Northern Liberties
    {"name": "Liberty Row Tacos", "description": "Hand-pressed tortillas, bright salsas, and mezcal slushies.", "phone_number": "267-555-4105", "address1": "600 N 2nd St", "city": "Philadelphia", "state": "PA", "zip": "19123", "lat": 39.9625, "lng": -75.141},
    {"name": "Girard Garden Cafe", "description": "All-day cafe with patio greenspace and fresh pastries.", "phone_number": "267-555-4106", "address1": "350 W Girard Ave", "city": "Philadelphia", "state": "PA", "zip": "19123", "lat": 39.9702, "lng": -75.1381},

    # Old City
    {"name": "Archway Tea & Tarts", "description": "Loose-leaf tea service, savory tarts, and quiet reading nooks.", "phone_number": "215-555-4107", "address1": "230 Arch St", "city": "Philadelphia", "state": "PA", "zip": "19106", "lat": 39.9506, "lng": -75.1452},
    {"name": "Old City Frame & Print", "description": "Custom framing studio with local print gallery.", "phone_number": "215-555-4108", "address1": "48 N 3rd St", "city": "Philadelphia", "state": "PA", "zip": "19106", "lat": 39.9518, "lng": -75.144},

    # University City
    {"name": "Spruce Street Study House", "description": "Student-friendly coffee bar with study pods and late hours.", "phone_number": "215-555-4109", "address1": "4000 Spruce St", "city": "Philadelphia", "state": "PA", "zip": "19104", "lat": 39.9521, "lng": -75.2053},
    {"name": "Campus Commons Market", "description": "Grab-and-go salads, grain bowls, and smoothies off Locust Walk.", "phone_number": "215-555-4110", "address1": "3720 Locust Walk", "city": "Philadelphia", "state": "PA", "zip": "19104", "lat": 39.9524, "lng": -75.1979},

    # Rittenhouse
    {"name": "Square Mile Gelato", "description": "Seasonal gelato flights, espresso affogatos, and park views.", "phone_number": "215-555-4111", "address1": "1801 Walnut St", "city": "Philadelphia", "state": "PA", "zip": "19103", "lat": 39.9504, "lng": -75.1706},
    {"name": "Rittenhouse Book Cellar", "description": "Curated fiction, author signings, and a cozy basement lounge.", "phone_number": "215-555-4112", "address1": "2043 Locust St", "city": "Philadelphia", "state": "PA", "zip": "19103", "lat": 39.9482, "lng": -75.1742},

    # East Passyunk / South Philly
    {"name": "Passyunk Pasta Lab", "description": "Fresh pasta counter with take-home sauces and weekend classes.", "phone_number": "267-555-4113", "address1": "1820 E Passyunk Ave", "city": "Philadelphia", "state": "PA", "zip": "19148", "lat": 39.9295, "lng": -75.1621},
    {"name": "South Philly Ferments", "description": "Pickle bar, kombucha on tap, and fermentation workshops.", "phone_number": "267-555-4114", "address1": "1205 Tasker St", "city": "Philadelphia", "state": "PA", "zip": "19148", "lat": 39.9299, "lng": -75.1658},

    # Manayunk
    {"name": "Canal House Coffee & Bike", "description": "Espresso, bike tune-ups, and canal trail meetups.", "phone_number": "215-555-4115", "address1": "4311 Main St", "city": "Philadelphia", "state": "PA", "zip": "19127", "lat": 40.0268, "lng": -75.2248},
    {"name": "Manayunk Clay Studio", "description": "Wheel-throwing classes, glazing nights, and local ceramics shop.", "phone_number": "215-555-4116", "address1": "107 Levering St", "city": "Philadelphia", "state": "PA", "zip": "19127", "lat": 40.0279, "lng": -75.2215},

    # Roxborough
    {"name": "Ridge Avenue Bakehouse", "description": "Morning buns, seeded loaves, and strong drip coffee.", "phone_number": "215-555-4117", "address1": "6750 Ridge Ave", "city": "Philadelphia", "state": "PA", "zip": "19128", "lat": 40.0289, "lng": -75.2207},
    {"name": "Hermits Lane Trail Supply", "description": "Day-hike kits, trail maps, and guided Wissahickon walks.", "phone_number": "215-555-4118", "address1": "750 Hermits Ln", "city": "Philadelphia", "state": "PA", "zip": "19128", "lat": 40.0265, "lng": -75.216},

    # Germantown
    {"name": "Germantown Grove Cafe", "description": "Neighborhood cafe with herbal lattes and garden patio.", "phone_number": "267-555-4119", "address1": "5901 Germantown Ave", "city": "Philadelphia", "state": "PA", "zip": "19144", "lat": 40.0375, "lng": -75.1729},
    {"name": "Maplewood Music Rooms", "description": "Lesson studios, rehearsal space, and a small stage.", "phone_number": "267-555-4120", "address1": "112 W Maplewood Mall", "city": "Philadelphia", "state": "PA", "zip": "19144", "lat": 40.0358, "lng": -75.1744},

    # Mt. Airy
    {"name": "Mt Airy Storyhouse", "description": "Independent bookstore with kids corner and poetry nights.", "phone_number": "215-555-4121", "address1": "7141 Germantown Ave", "city": "Philadelphia", "state": "PA", "zip": "19119", "lat": 40.0596, "lng": -75.1917},
    {"name": "Carpenter Lane Provisions", "description": "Local produce, cheese counter, and breakfast sandwiches.", "phone_number": "215-555-4122", "address1": "110 Carpenter Ln", "city": "Philadelphia", "state": "PA", "zip": "19119", "lat": 40.0539, "lng": -75.19},

    # Chestnut Hill
    {"name": "Avenue Artisanal Chocolate", "description": "Bean-to-bar chocolates, sipping cocoa, and bonbons.", "phone_number": "215-555-4123", "address1": "8517 Germantown Ave", "city": "Philadelphia", "state": "PA", "zip": "19118", "lat": 40.0785, "lng": -75.2071},
    {"name": "Chestnut Hill Lantern Yoga", "description": "Sunrise yoga, gentle flows, and small-group workshops.", "phone_number": "215-555-4124", "address1": "30 W Highland Ave", "city": "Philadelphia", "state": "PA", "zip": "19118", "lat": 40.0794, "lng": -75.2052},

    # Bala Cynwyd
    {"name": "Bala Cynwyd Breadboard", "description": "Sourdough bakery with soup counter and picnic kits.", "phone_number": "610-555-4125", "address1": "15 Montgomery Ave", "city": "Bala Cynwyd", "state": "PA", "zip": "19004", "lat": 40.0057, "lng": -75.2293},
    {"name": "Schuylkill River Cycle Bar", "description": "Performance cycling classes and smoothie bar.", "phone_number": "610-555-4126", "address1": "201 Belmont Ave", "city": "Bala Cynwyd", "state": "PA", "zip": "19004", "lat": 40.0068, "lng": -75.233},

    # Ardmore
    {"name": "Suburban Square Spice Co.", "description": "Global spice blends, olive oils, and tasting flights.", "phone_number": "610-555-4127", "address1": "60 Cricket Ave", "city": "Ardmore", "state": "PA", "zip": "19003", "lat": 40.0074, "lng": -75.2882},
    {"name": "Lancaster Ave Record Bar", "description": "Records, hi-fi demos, and evening listening parties.", "phone_number": "610-555-4128", "address1": "44 E Lancaster Ave", "city": "Ardmore", "state": "PA", "zip": "19003", "lat": 40.0078, "lng": -75.2859},

    # Bryn Mawr
    {"name": "Bryn Mawr Bloom", "description": "Florist with stems by the stem and bouquet classes.", "phone_number": "610-555-4129", "address1": "842 Lancaster Ave", "city": "Bryn Mawr", "state": "PA", "zip": "19010", "lat": 40.024, "lng": -75.316},
    {"name": "Rosemont Roast Lab", "description": "Pour-over bar, tasting flights, and beans to go.", "phone_number": "610-555-4130", "address1": "1042 County Line Rd", "city": "Bryn Mawr", "state": "PA", "zip": "19010", "lat": 40.0218, "lng": -75.3112},

    # Wayne
    {"name": "Wayne Grain & Hearth", "description": "Heirloom grain bakery with open-hearth loaves.", "phone_number": "610-555-4131", "address1": "125 W Lancaster Ave", "city": "Wayne", "state": "PA", "zip": "19087", "lat": 40.044, "lng": -75.3879},
    {"name": "Radnor Trail Outfitters", "description": "Trail shoes, hydration kits, and local run meetups.", "phone_number": "610-555-4132", "address1": "301 N Wayne Ave", "city": "Wayne", "state": "PA", "zip": "19087", "lat": 40.0456, "lng": -75.3811},

    # King of Prussia
    {"name": "Valley Forge Coffee Works", "description": "Espresso, drip bar, and camp-friendly gear wall.", "phone_number": "610-555-4133", "address1": "400 Mall Blvd", "city": "King of Prussia", "state": "PA", "zip": "19406", "lat": 40.1013, "lng": -75.3831},
    {"name": "KOP Noodle House", "description": "Brothy noodles, bao, and bubble tea near the plaza.", "phone_number": "610-555-4134", "address1": "200 N Gulph Rd", "city": "King of Prussia", "state": "PA", "zip": "19406", "lat": 40.0959, "lng": -75.37},

    # Conshohocken
    {"name": "Riverfront Toast & Co.", "description": "All-day brunch spot with river views and spritzes.", "phone_number": "610-555-4135", "address1": "2 Ash St", "city": "Conshohocken", "state": "PA", "zip": "19428", "lat": 40.0798, "lng": -75.3016},
    {"name": "Fayette Street Ferments", "description": "House pickles, kraut dogs, and a small beer list.", "phone_number": "610-555-4136", "address1": "320 Fayette St", "city": "Conshohocken", "state": "PA", "zip": "19428", "lat": 40.0779, "lng": -75.3},

    # Plymouth Meeting
    {"name": "Plymouth Pour House", "description": "Cafe with cold brew bar, pastries, and shared workspace.", "phone_number": "610-555-4137", "address1": "500 W Germantown Pike", "city": "Plymouth Meeting", "state": "PA", "zip": "19462", "lat": 40.115, "lng": -75.276},
    {"name": "Meetinghouse Climb & Juice", "description": "Bouldering gym with smoothie and juice counter.", "phone_number": "610-555-4138", "address1": "1200 Chemical Rd", "city": "Plymouth Meeting", "state": "PA", "zip": "19462", "lat": 40.1132, "lng": -75.281},

    # Norristown
    {"name": "Main Line Dumpling Co.", "description": "Street-style dumplings, hand-pulled noodles, and tea.", "phone_number": "610-555-4139", "address1": "520 Dekalb St", "city": "Norristown", "state": "PA", "zip": "19401", "lat": 40.1215, "lng": -75.3399},
    {"name": "Elmwood Craft Bar", "description": "Small cocktail bar with seasonal bites and vinyl nights.", "phone_number": "610-555-4140", "address1": "17 W Elm St", "city": "Norristown", "state": "PA", "zip": "19401", "lat": 40.1122, "lng": -75.3441},

    # Media
    {"name": "State Street Grain Bowls", "description": "Build-your-own bowls with roasted veggies and grains.", "phone_number": "610-555-4141", "address1": "304 W State St", "city": "Media", "state": "PA", "zip": "19063", "lat": 39.9173, "lng": -75.3931},
    {"name": "Media Porch Coffee", "description": "Front-porch cafe vibe with scones and seasonal lattes.", "phone_number": "610-555-4142", "address1": "18 S Olive St", "city": "Media", "state": "PA", "zip": "19063", "lat": 39.916, "lng": -75.3894},

    # Springfield
    {"name": "Baltimore Pike Biscuit Co.", "description": "Flaky biscuits, fried chicken, and honey butter jars.", "phone_number": "610-555-4143", "address1": "825 Baltimore Pike", "city": "Springfield", "state": "PA", "zip": "19064", "lat": 39.9305, "lng": -75.3202},
    {"name": "Springfield Spin Studio", "description": "Rhythm rides with stadium lighting and live DJs.", "phone_number": "610-555-4144", "address1": "35 Saxer Ave", "city": "Springfield", "state": "PA", "zip": "19064", "lat": 39.9324, "lng": -75.3279},

    # Swarthmore
    {"name": "College Avenue Crepes", "description": "Sweet and savory crepes with campus-sourced produce.", "phone_number": "610-555-4145", "address1": "5 S Chester Rd", "city": "Swarthmore", "state": "PA", "zip": "19081", "lat": 39.9029, "lng": -75.3499},
    {"name": "Swarthmore Booksmith", "description": "Indie bookshop with study tables and local author shelf.", "phone_number": "610-555-4146", "address1": "12 Park Ave", "city": "Swarthmore", "state": "PA", "zip": "19081", "lat": 39.9041, "lng": -75.353},

    # Newtown Square
    {"name": "Ellis Preserve Provisions", "description": "Prepared foods, cheese counter, and espresso.", "phone_number": "610-555-4147", "address1": "3859 W Chester Pike", "city": "Newtown Square", "state": "PA", "zip": "19073", "lat": 39.988, "lng": -75.399},
    {"name": "Newtown Square Barre & Brew", "description": "Morning barre classes with post-class coffee bar.", "phone_number": "610-555-4148", "address1": "20 Saint Albans Ave", "city": "Newtown Square", "state": "PA", "zip": "19073", "lat": 39.98, "lng": -75.4052},

    # Havertown
    {"name": "Brookline Bean", "description": "Neighborhood coffee counter with rotating pastry pop-ups.", "phone_number": "610-555-4149", "address1": "120 Brookline Blvd", "city": "Havertown", "state": "PA", "zip": "19083", "lat": 39.9809, "lng": -75.3086},
    {"name": "Haverford Trail Goods", "description": "Running shoes, hydration packs, and group runs.", "phone_number": "610-555-4150", "address1": "203 Darby Rd", "city": "Havertown", "state": "PA", "zip": "19083", "lat": 39.9791, "lng": -75.3034},

    # Upper Darby
    {"name": "69th Street Dumpling Hall", "description": "Counter-service dumplings, noodles, and bubble tea.", "phone_number": "610-555-4151", "address1": "30 S 69th St", "city": "Upper Darby", "state": "PA", "zip": "19082", "lat": 39.9584, "lng": -75.2591},
    {"name": "Market Street Vinyl Upper Darby", "description": "Used records, tapes, and Friday listening parties.", "phone_number": "610-555-4152", "address1": "7016 Market St", "city": "Upper Darby", "state": "PA", "zip": "19082", "lat": 39.957, "lng": -75.2599},

    # Lansdowne
    {"name": "Lansdowne Porch Pantry", "description": "Locally made jams, breads, and weekend farmers table.", "phone_number": "610-555-4153", "address1": "24 N Lansdowne Ave", "city": "Lansdowne", "state": "PA", "zip": "19050", "lat": 39.9384, "lng": -75.2726},
    {"name": "Baltimore Pike Bike Co.", "description": "Commuter bike fits, tune-ups, and a small espresso bar.", "phone_number": "610-555-4154", "address1": "121 E Baltimore Ave", "city": "Lansdowne", "state": "PA", "zip": "19050", "lat": 39.9397, "lng": -75.2681},

    # Jenkintown
    {"name": "York Road Espresso", "description": "Espresso shots, cortados, and window bar seating.", "phone_number": "215-555-4155", "address1": "700 York Rd", "city": "Jenkintown", "state": "PA", "zip": "19046", "lat": 40.0957, "lng": -75.1246},
    {"name": "Jenkintown Press & Paper", "description": "Stationery, art prints, and a risograph corner.", "phone_number": "215-555-4156", "address1": "309 Leedom St", "city": "Jenkintown", "state": "PA", "zip": "19046", "lat": 40.0942, "lng": -75.1259},

    # Abington
    {"name": "Old York Road Bagelry", "description": "Hand-rolled bagels, schmears, and cold brew.", "phone_number": "215-555-4157", "address1": "1575 Old York Rd", "city": "Abington", "state": "PA", "zip": "19001", "lat": 40.1204, "lng": -75.1249},
    {"name": "Abington Trailhouse", "description": "Trail snacks, camping basics, and map wall for local hikes.", "phone_number": "215-555-4158", "address1": "1331 Easton Rd", "city": "Abington", "state": "PA", "zip": "19001", "lat": 40.1181, "lng": -75.124},

    # Willow Grove
    {"name": "Willow Grove Juice Co.", "description": "Cold-pressed juices, smoothies, and acai bowls.", "phone_number": "215-555-4159", "address1": "401 Easton Rd", "city": "Willow Grove", "state": "PA", "zip": "19090", "lat": 40.1443, "lng": -75.115},
    {"name": "Park Avenue Play Cafe", "description": "Family-friendly cafe with play space and drip coffee bar.", "phone_number": "215-555-4160", "address1": "105 Park Ave", "city": "Willow Grove", "state": "PA", "zip": "19090", "lat": 40.1431, "lng": -75.1132},

    # Ambler
    {"name": "Butler Pike Biscotti", "description": "Espresso, biscotti flights, and Italian cookies.", "phone_number": "215-555-4161", "address1": "97 E Butler Ave", "city": "Ambler", "state": "PA", "zip": "19002", "lat": 40.154, "lng": -75.2216},
    {"name": "Ambler Night Market", "description": "Evening food hall with rotating chef pop-ups.", "phone_number": "215-555-4162", "address1": "20 N Main St", "city": "Ambler", "state": "PA", "zip": "19002", "lat": 40.1549, "lng": -75.221},

    # Blue Bell
    {"name": "Skippack Pike Coffee Shed", "description": "Drive-thru espresso hut with scratch muffins.", "phone_number": "610-555-4163", "address1": "924 Skippack Pike", "city": "Blue Bell", "state": "PA", "zip": "19422", "lat": 40.1526, "lng": -75.267},
    {"name": "Blue Bell Bike & Brew", "description": "Cycling shop with espresso bar and weekly rideouts.", "phone_number": "610-555-4164", "address1": "38 Dekalb Pike", "city": "Blue Bell", "state": "PA", "zip": "19422", "lat": 40.149, "lng": -75.2679},

    # Fort Washington
    {"name": "Fort Hill Roasters", "description": "Small-batch roasting, cupping lab, and retail beans.", "phone_number": "215-555-4165", "address1": "1105 Virginia Dr", "city": "Fort Washington", "state": "PA", "zip": "19034", "lat": 40.1418, "lng": -75.2045},
    {"name": "Militia Hill Trail Snacks", "description": "Grab-and-go trail snacks, cold brew, and picnic kits.", "phone_number": "215-555-4166", "address1": "420 Pennsylvania Ave", "city": "Fort Washington", "state": "PA", "zip": "19034", "lat": 40.139, "lng": -75.2058},

    # Glenside
    {"name": "Keswick Coffee Corner", "description": "Neighborhood coffee, crumb cake, and patio tables.", "phone_number": "215-555-4167", "address1": "294 Keswick Ave", "city": "Glenside", "state": "PA", "zip": "19038", "lat": 40.1026, "lng": -75.1523},
    {"name": "Glenside Strings & Things", "description": "Guitars, lessons, and a tiny listening room.", "phone_number": "215-555-4168", "address1": "28 W Glenside Ave", "city": "Glenside", "state": "PA", "zip": "19038", "lat": 40.1021, "lng": -75.1549},

    # Doylestown
    {"name": "Court Street Cider House", "description": "Small-batch ciders, cheese boards, and weekend markets.", "phone_number": "215-555-4169", "address1": "30 E Court St", "city": "Doylestown", "state": "PA", "zip": "18901", "lat": 40.3101, "lng": -75.1307},
    {"name": "Doylestown Meadow Market", "description": "Farm-to-table cafe with pantry goods and local flowers.", "phone_number": "215-555-4170", "address1": "12 W State St", "city": "Doylestown", "state": "PA", "zip": "18901", "lat": 40.3109, "lng": -75.1322},

    # New Hope
    {"name": "Canal Path Coffee", "description": "Espresso, cold brew, and canal path bike parking.", "phone_number": "215-555-4171", "address1": "49 W Bridge St", "city": "New Hope", "state": "PA", "zip": "18938", "lat": 40.3645, "lng": -74.9513},
    {"name": "New Hope River Kitchen", "description": "Seasonal small plates with Delaware River views.", "phone_number": "215-555-4172", "address1": "10 S Main St", "city": "New Hope", "state": "PA", "zip": "18938", "lat": 40.3619, "lng": -74.9502},

    # Yardley
    {"name": "Yardley Bean & Barrel", "description": "Coffee, barrel-aged cold brew, and breakfast sandwiches.", "phone_number": "215-555-4173", "address1": "25 S Main St", "city": "Yardley", "state": "PA", "zip": "19067", "lat": 40.2412, "lng": -74.83},
    {"name": "Canal Street Cheese Shop", "description": "Cheese counter, picnic packs, and riverside seating.", "phone_number": "215-555-4174", "address1": "5 Canal St", "city": "Yardley", "state": "PA", "zip": "19067", "lat": 40.2451, "lng": -74.83},

    # Langhorne
    {"name": "Middletown Roastery", "description": "Roasting lab with cuppings and brew classes.", "phone_number": "215-555-4175", "address1": "100 E Maple Ave", "city": "Langhorne", "state": "PA", "zip": "19047", "lat": 40.1746, "lng": -74.922},
    {"name": "Langhorne Trail Cafe", "description": "Bike-friendly cafe with smoothies and grain bowls.", "phone_number": "215-555-4176", "address1": "20 S Bellevue Ave", "city": "Langhorne", "state": "PA", "zip": "19047", "lat": 40.1728, "lng": -74.9199},

    # Bensalem
    {"name": "Neshaminy Creek Coffee", "description": "Espresso bar, cold brew taps, and creekside patio.", "phone_number": "215-555-4177", "address1": "3020 Bristol Rd", "city": "Bensalem", "state": "PA", "zip": "19020", "lat": 40.0996, "lng": -74.93},
    {"name": "Bensalem Dumpling Kitchen", "description": "Pan-fried dumplings, noodle bowls, and milk tea.", "phone_number": "215-555-4178", "address1": "2343 Street Rd", "city": "Bensalem", "state": "PA", "zip": "19020", "lat": 40.1009, "lng": -74.951},

    # Bristol
    {"name": "Mill Street Muffins", "description": "Morning muffins, drip coffee, and riverfront benches.", "phone_number": "215-555-4179", "address1": "301 Mill St", "city": "Bristol", "state": "PA", "zip": "19007", "lat": 40.1007, "lng": -74.8517},
    {"name": "Bristol Wharf BBQ", "description": "Smoked brisket, pit beans, and waterfront seating.", "phone_number": "215-555-4180", "address1": "50 Radcliffe St", "city": "Bristol", "state": "PA", "zip": "19007", "lat": 40.1019, "lng": -74.8565},

    # Camden
    {"name": "Waterfront Espresso Camden", "description": "Espresso bar with skyline views across the river.", "phone_number": "856-555-4181", "address1": "2 Riverside Dr", "city": "Camden", "state": "NJ", "zip": "08103", "lat": 39.944, "lng": -75.1196},
    {"name": "Cooper Street Social", "description": "Casual small plates, mocktails, and outdoor seating.", "phone_number": "856-555-4182", "address1": "301 Cooper St", "city": "Camden", "state": "NJ", "zip": "08102", "lat": 39.948, "lng": -75.12},

    # Collingswood
    {"name": "Haddon Avenue Coffee Bar", "description": "Slow bar coffee, tea service, and weekend tastings.", "phone_number": "856-555-4183", "address1": "688 Haddon Ave", "city": "Collingswood", "state": "NJ", "zip": "08108", "lat": 39.9182, "lng": -75.0718},
    {"name": "Collingswood Kitchen Market", "description": "Prepared foods, pantry staples, and farm produce.", "phone_number": "856-555-4184", "address1": "12 Lees Ave", "city": "Collingswood", "state": "NJ", "zip": "08108", "lat": 39.9191, "lng": -75.0735},

    # Haddonfield
    {"name": "Kings Highway Tea Room", "description": "Tea flights, finger sandwiches, and quiet courtyard.", "phone_number": "856-555-4185", "address1": "129 Kings Hwy E", "city": "Haddonfield", "state": "NJ", "zip": "08033", "lat": 39.8912, "lng": -75.0377},
    {"name": "Tanner Street Bread Co.", "description": "Naturally leavened loaves, croissants, and coffee.", "phone_number": "856-555-4186", "address1": "48 Tanner St", "city": "Haddonfield", "state": "NJ", "zip": "08033", "lat": 39.89, "lng": -75.0355},

    # Haddon Heights
    {"name": "Station Ave Sandwiches", "description": "Stacked sandwiches, soups, and back patio seating.", "phone_number": "856-555-4187", "address1": "600 Station Ave", "city": "Haddon Heights", "state": "NJ", "zip": "08035", "lat": 39.8851, "lng": -75.0652},
    {"name": "Heights Bean & Biscuit", "description": "Coffee, biscuits, and housemade jams.", "phone_number": "856-555-4188", "address1": "120 White Horse Pike", "city": "Haddon Heights", "state": "NJ", "zip": "08035", "lat": 39.8836, "lng": -75.064},

    # Cherry Hill
    {"name": "Barclay Farms Juice Bar", "description": "Cold-pressed juices, smoothie bowls, and toasts.", "phone_number": "856-555-4189", "address1": "1800 Marlton Pike E", "city": "Cherry Hill", "state": "NJ", "zip": "08003", "lat": 39.932, "lng": -75.0307},
    {"name": "Cherry Hill Craft Noodle", "description": "Ramen, bao, and late-night snacks near the mall.", "phone_number": "856-555-4190", "address1": "400 Route 38", "city": "Cherry Hill", "state": "NJ", "zip": "08002", "lat": 39.9415, "lng": -75.024},

    # Moorestown
    {"name": "Main Street Market Moorestown", "description": "Cafe, deli counter, and fresh bread wall.", "phone_number": "856-555-4191", "address1": "159 W Main St", "city": "Moorestown", "state": "NJ", "zip": "08057", "lat": 39.9676, "lng": -74.9485},
    {"name": "Strawbridge Lake Outfitters", "description": "Kayak rentals, trail gear, and picnic kits.", "phone_number": "856-555-4192", "address1": "72 W Camden Ave", "city": "Moorestown", "state": "NJ", "zip": "08057", "lat": 39.9689, "lng": -74.947},

    # Mount Laurel
    {"name": "Laurel Creek Coffee Co.", "description": "Espresso, nitro cold brew, and quiet study bar.", "phone_number": "856-555-4193", "address1": "3103 Route 38", "city": "Mount Laurel", "state": "NJ", "zip": "08054", "lat": 39.9476, "lng": -74.9034},
    {"name": "Mount Laurel Pho House", "description": "Pho, banh mi, and iced Vietnamese coffee.", "phone_number": "856-555-4194", "address1": "1200 Route 73", "city": "Mount Laurel", "state": "NJ", "zip": "08054", "lat": 39.9461, "lng": -74.906},

    # Marlton
    {"name": "Evesham Woodfired Pizza", "description": "Neapolitan pies, salads, and backyard fire pits.", "phone_number": "856-555-4195", "address1": "751 Route 70 W", "city": "Marlton", "state": "NJ", "zip": "08053", "lat": 39.8912, "lng": -74.9217},
    {"name": "Marlton Market Hall", "description": "Indoor market with rotating local food vendors.", "phone_number": "856-555-4196", "address1": "15 S Maple Ave", "city": "Marlton", "state": "NJ", "zip": "08053", "lat": 39.8919, "lng": -74.9251},

    # Maple Shade
    {"name": "Maple Shade Morning Cafe", "description": "Breakfast sandwiches, drip coffee, and fresh donuts.", "phone_number": "856-555-4197", "address1": "38 Main St", "city": "Maple Shade", "state": "NJ", "zip": "08052", "lat": 39.954, "lng": -74.995},
    {"name": "Collins Lane Comics & Coffee", "description": "Comics shop with espresso counter and cozy chairs.", "phone_number": "856-555-4198", "address1": "127 Collins Ln", "city": "Maple Shade", "state": "NJ", "zip": "08052", "lat": 39.9561, "lng": -74.9931},

    # Pennsauken
    {"name": "Pennsauken Bean Roasters", "description": "Roastery with cupping room and retail beans.", "phone_number": "856-555-4199", "address1": "3701 Marlton Pike", "city": "Pennsauken", "state": "NJ", "zip": "08110", "lat": 39.9567, "lng": -75.0637},
    {"name": "Cove Road BBQ", "description": "Smoked ribs, pulled pork, and picnic table seating.", "phone_number": "856-555-4200", "address1": "6000 Cove Rd", "city": "Pennsauken", "state": "NJ", "zip": "08109", "lat": 39.9579, "lng": -75.0489},

    # Wilmington, DE (additional 50)
    {"name": "Riverfront Roasters", "description": "Waterfront espresso bar with early commuter hours.", "phone_number": "302-555-4201", "address1": "920 Justison St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7311, "lng": -75.5627},
    {"name": "Christina Market Hall", "description": "Shared food hall with local vendors and river views.", "phone_number": "302-555-4202", "address1": "815 Justison St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7336, "lng": -75.5615},
    {"name": "Riverwalk Taproom", "description": "Rotating taps, soft pretzels, and patio seating by the riverwalk.", "phone_number": "302-555-4203", "address1": "600 Justison St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7348, "lng": -75.5619},
    {"name": "Frawley Scoop Shop", "description": "Small-batch ice cream and espresso next to the ballpark.", "phone_number": "302-555-4204", "address1": "801 Shipyard Dr", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7318, "lng": -75.5636},
    {"name": "Shipyard Pizza Co.", "description": "Brick-oven pies and cold beer steps from the river.", "phone_number": "302-555-4205", "address1": "601 S Madison St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7334, "lng": -75.5623},
    {"name": "Southbridge Smokehouse", "description": "Smoked ribs, wings, and cornbread with picnic seating.", "phone_number": "302-555-4206", "address1": "400 Heald St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7306, "lng": -75.5411},
    {"name": "South Market Tacos", "description": "Street tacos, agua frescas, and salsa flights.", "phone_number": "302-555-4207", "address1": "214 S Market St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7394, "lng": -75.5528},
    {"name": "Riverfront Plant House", "description": "Houseplants, pots, and a potting bar by the river.", "phone_number": "302-555-4208", "address1": "301 Justison St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.736, "lng": -75.561},
    {"name": "Riverfront Cycle Club", "description": "Spin studio with metrics board and river views.", "phone_number": "302-555-4209", "address1": "401 Harlan Blvd", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7364, "lng": -75.5602},
    {"name": "Christina Yoga Loft", "description": "Heated flows, restorative classes, and sunrise sessions.", "phone_number": "302-555-4210", "address1": "113 S West St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7388, "lng": -75.5517},

    {"name": "Market Street Book Nook", "description": "Indie bookshop with local author shelf and coffee bar.", "phone_number": "302-555-4211", "address1": "707 N Market St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7399, "lng": -75.548},
    {"name": "Rodney Square Espresso", "description": "Grab-and-go espresso, matcha, and breakfast bites.", "phone_number": "302-555-4212", "address1": "1000 N Market St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7443, "lng": -75.5488},
    {"name": "Orange Street Vinyl", "description": "Vinyl listening bar with espresso and small plates.", "phone_number": "302-555-4213", "address1": "913 N Orange St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7437, "lng": -75.5475},
    {"name": "Shipley Street Provisions", "description": "Sandwiches, soups, and pantry goods near Rodney Square.", "phone_number": "302-555-4214", "address1": "401 N Shipley St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.741, "lng": -75.5506},
    {"name": "King Street Dumplings", "description": "Hand-pinched dumplings, bao, and noodle bowls.", "phone_number": "302-555-4215", "address1": "501 N King St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7431, "lng": -75.5478},
    {"name": "Rodney Plaza Salad Co.", "description": "Build-your-own salads, grain bowls, and smoothies.", "phone_number": "302-555-4216", "address1": "800 N King St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7423, "lng": -75.5484},
    {"name": "Midtown Grain & Bowl", "description": "Hearty bowls, cold-pressed juice, and counter seating.", "phone_number": "302-555-4217", "address1": "300 Delaware Ave", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7447, "lng": -75.5472},
    {"name": "Quaker Hill Coffee House", "description": "Neighborhood cafe with pour-overs and baked goods.", "phone_number": "302-555-4218", "address1": "521 W 5th St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7394, "lng": -75.5537},
    {"name": "Quaker Hill Bread Co.", "description": "Sourdough loaves, pastries, and sandwich counter.", "phone_number": "302-555-4219", "address1": "520 W 7th St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7389, "lng": -75.5547},
    {"name": "West 9th Gelato Lab", "description": "Gelato flights, espresso, and seasonal toppings.", "phone_number": "302-555-4220", "address1": "117 W 9th St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7424, "lng": -75.5517},

    {"name": "Trolley Square Gelato", "description": "Gelato window, espresso, and evening stroll spot.", "phone_number": "302-555-4221", "address1": "1401 N Dupont St", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7589, "lng": -75.5665},
    {"name": "Delaware Ave Print Shop", "description": "Letterpress cards, posters, and custom stationery.", "phone_number": "302-555-4222", "address1": "1700 Delaware Ave", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7553, "lng": -75.5655},
    {"name": "Lovering Street Roasters", "description": "Single-origin espresso, pour-overs, and beans to go.", "phone_number": "302-555-4223", "address1": "1701 Lovering Ave", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7534, "lng": -75.5614},
    {"name": "Rockford Park Picnic Co.", "description": "Picnic boards, lemonade, and blankets near the tower.", "phone_number": "302-555-4224", "address1": "2501 W 18th St", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7602, "lng": -75.5744},
    {"name": "Kentmere Cheese & Wine", "description": "Cut-to-order cheese, charcuterie, and natural wine.", "phone_number": "302-555-4225", "address1": "1801 N Broom St", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7601, "lng": -75.5621},
    {"name": "Highlands Yoga Loft", "description": "Small-group yoga, pilates, and meditation sessions.", "phone_number": "302-555-4226", "address1": "2301 Kentmere Pkwy", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7606, "lng": -75.5658},
    {"name": "Parkside Plant House", "description": "Indoor plants, terrariums, and repotting station.", "phone_number": "302-555-4227", "address1": "1301 Greenhill Ave", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7581, "lng": -75.5704},
    {"name": "Trolley Tap & Table", "description": "Craft beer bar with small plates and vinyl nights.", "phone_number": "302-555-4228", "address1": "1616 Delaware Ave", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7543, "lng": -75.5639},
    {"name": "Broom Street Books", "description": "New and used books with cozy reading corners.", "phone_number": "302-555-4229", "address1": "1501 N Broom St", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7579, "lng": -75.5628},
    {"name": "Tower Hill Bakehouse", "description": "Morning pastries, baguettes, and espresso bar.", "phone_number": "302-555-4230", "address1": "2621 W 17th St", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7589, "lng": -75.5776},

    {"name": "Union Street Cannoli", "description": "Italian pastries, cannoli flights, and espresso.", "phone_number": "302-555-4231", "address1": "801 N Union St", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7494, "lng": -75.5651},
    {"name": "Union Street Pasta Lab", "description": "Fresh pasta shop with sauces and take-home kits.", "phone_number": "302-555-4232", "address1": "900 N Union St", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7506, "lng": -75.5648},
    {"name": "Lancaster Ave Market", "description": "Local produce, deli sandwiches, and coffee.", "phone_number": "302-555-4233", "address1": "1101 Lancaster Ave", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7461, "lng": -75.5644},
    {"name": "Tilton Park Coffee", "description": "Neighborhood coffee with pastries and outdoor seating.", "phone_number": "302-555-4234", "address1": "1100 W 7th St", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7446, "lng": -75.5575},
    {"name": "Brown-Burton BBQ", "description": "Low-and-slow brisket, ribs, and classic sides.", "phone_number": "302-555-4235", "address1": "900 Maryland Ave", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.741, "lng": -75.566},
    {"name": "Maryland Avenue Plant Co.", "description": "Houseplants, pots, and giftable greenery.", "phone_number": "302-555-4236", "address1": "1400 Maryland Ave", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7383, "lng": -75.5677},
    {"name": "Canby Park Juice", "description": "Smoothies, acai bowls, and cold-pressed juice.", "phone_number": "302-555-4237", "address1": "2101 Maryland Ave", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7298, "lng": -75.5774},
    {"name": "Little Italy Gelato Bar", "description": "Gelato, espresso, and tiramisu cups.", "phone_number": "302-555-4238", "address1": "903 N Lincoln St", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7471, "lng": -75.5669},
    {"name": "West Side Vinyl", "description": "Used vinyl, cassettes, and a small coffee counter.", "phone_number": "302-555-4239", "address1": "501 W 4th St", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7412, "lng": -75.5525},
    {"name": "Cool Spring Bagels", "description": "Hand-rolled bagels, schmears, and iced coffee.", "phone_number": "302-555-4240", "address1": "1010 W 10th St", "city": "Wilmington", "state": "DE", "zip": "19805", "lat": 39.7478, "lng": -75.5605},

    {"name": "Prices Run Provisions", "description": "Cafe, sandwiches, and groceries for nearby blocks.", "phone_number": "302-555-4241", "address1": "2201 N Market St", "city": "Wilmington", "state": "DE", "zip": "19802", "lat": 39.7582, "lng": -75.5327},
    {"name": "East Side Plant Studio", "description": "Plant studio with terrarium workshops and soil bar.", "phone_number": "302-555-4242", "address1": "900 Bennett St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7435, "lng": -75.5315},
    {"name": "Brandywine Bowl & Grain", "description": "Grain bowls, salads, and smoothies near the park.", "phone_number": "302-555-4243", "address1": "900 Vandever Ave", "city": "Wilmington", "state": "DE", "zip": "19802", "lat": 39.7509, "lng": -75.5251},
    {"name": "Riverside Juice Co.", "description": "Fresh juice, smoothies, and light snacks to-go.", "phone_number": "302-555-4244", "address1": "600 E 23rd St", "city": "Wilmington", "state": "DE", "zip": "19802", "lat": 39.7476, "lng": -75.5269},
    {"name": "Concord Ave Coffee", "description": "Espresso bar, pastries, and sidewalk seating.", "phone_number": "302-555-4245", "address1": "2300 N Washington St", "city": "Wilmington", "state": "DE", "zip": "19802", "lat": 39.7536, "lng": -75.528},
    {"name": "Clifford Brown Music Lounge", "description": "Coffee, live jazz nights, and listening room.", "phone_number": "302-555-4246", "address1": "1200 N Tatnall St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7501, "lng": -75.5504},
    {"name": "Trolley Car Cheese", "description": "Cheese counter, charcuterie, and picnic kits to go.", "phone_number": "302-555-4247", "address1": "2001 Delaware Ave", "city": "Wilmington", "state": "DE", "zip": "19806", "lat": 39.7576, "lng": -75.5669},
    {"name": "Baynard Boulevard Bakehouse", "description": "Morning breads, croissants, and coffee service.", "phone_number": "302-555-4248", "address1": "2600 Baynard Blvd", "city": "Wilmington", "state": "DE", "zip": "19802", "lat": 39.7637, "lng": -75.5343},
    {"name": "Brandywine Market & Deli", "description": "Deli sandwiches, salads, and picnic provisions.", "phone_number": "302-555-4249", "address1": "2610 N Market St", "city": "Wilmington", "state": "DE", "zip": "19802", "lat": 39.7606, "lng": -75.5335},
    {"name": "Monroe Street Dumplings", "description": "Dumplings, hand-cut noodles, and chili crisp bar.", "phone_number": "302-555-4250", "address1": "700 Monroe St", "city": "Wilmington", "state": "DE", "zip": "19801", "lat": 39.7416, "lng": -75.5513},
]


def main():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        admin_email = os.getenv("SEED_ADMIN_EMAIL", "bizcribeco@gmail.com")
        admin_password = os.getenv("SEED_ADMIN_PASSWORD", "Admin1!")
        admin = session.query(models_user.User).filter_by(email=admin_email).first()
        if not admin:
            password_hash = bcrypt.hashpw(admin_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            admin = models_user.User(
                email=admin_email,
                password_hash=password_hash,
                display_name="Seed Admin",
                role=models_user.UserRole.ADMIN,
            )
            session.add(admin)
            session.commit()
            print(f"Created admin user {admin_email} (password: {admin_password})")
        else:
            print(f"Admin user {admin_email} already exists; skipping create.")

        # Default cleanup: wipe business-related tables (keeps users intact).
        # Set RESET_BUSINESSES=0 to skip.
        if os.getenv("RESET_BUSINESSES", "1") != "0":
            print("RESET_BUSINESSES enabled -> Clearing business data (keeps users).")
            for model in (
                models_user.CheckIn,
                models_user.Favorite,
                models_user.Review,
                models_user.BusinessMembership,
                models.BusinessVetting,
                models.BusinessSubmission,
                models.Business,
            ):
                deleted = session.query(model).delete(synchronize_session=False)
                print(f"Deleted {deleted} rows from {model.__tablename__}.")
            session.commit()

        existing = session.query(models.Business).count()
        if existing >= len(BUSINESSES):
            print(f"Skip seeding: {existing} businesses already present.")
            return

        items = []
        for entry in BUSINESSES:
            items.append(
                models.Business(
                    name=entry["name"],
                    description=entry["description"],
                    phone_number=entry["phone_number"],
                    location=f"{entry['address1']}, {entry['city']}, {entry['state']} {entry['zip']}",
                    lat=entry["lat"],
                    lng=entry["lng"],
                    hide_address=False,
                    address1=entry["address1"],
                    city=entry["city"],
                    state=entry["state"],
                    zip=entry["zip"],
                    is_approved=True,
                    approved_at=datetime.now(timezone.utc),
                    approved_by_id=None,
                    created_by_id=None,
                )
            )

        session.bulk_save_objects(items)
        session.commit()
        print(f"Inserted {len(items)} businesses.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
