// District-court reference data (PRD §7, §10 `districtCourts`).
//
// SEED, NOT AUTHORITATIVE. ~150 district/sessions court complexes covering every State/UT, with
// APPROXIMATE coordinates (district HQ / court-complex area, ~1 km precision) — plenty for
// 40 km radius matching. The full ~700-court list should be imported from the public eCourts
// directory via `geo.importDistrictCourts` (PRD open question #1); the import upserts by `code`.
//
// Row format: [code, court name, district, state, lat, lng, extra city aliases used to
// recognise the place in free text]
export type CourtRow = [string, string, string, string, number, number, string[]?];

export const DISTRICT_COURTS: CourtRow[] = [
  // ── Delhi (court complexes) ──
  ["DL-THC", "Tis Hazari Courts", "Central & West Delhi", "Delhi", 28.667, 77.216, ["delhi", "old delhi", "karol bagh"]],
  ["DL-PHC", "Patiala House Courts", "New Delhi", "Delhi", 28.616, 77.236, ["new delhi", "connaught place", "india gate"]],
  ["DL-KKD", "Karkardooma Courts", "East & North-East Delhi", "Delhi", 28.649, 77.302, ["east delhi", "laxmi nagar", "shahdara", "preet vihar"]],
  ["DL-RHN", "Rohini Courts", "North-West Delhi", "Delhi", 28.716, 77.116, ["rohini", "pitampura"]],
  ["DL-DWK", "Dwarka Courts", "South-West Delhi", "Delhi", 28.581, 77.05, ["dwarka", "janakpuri", "uttam nagar"]],
  ["DL-SKT", "Saket Courts", "South Delhi", "Delhi", 28.524, 77.211, ["saket", "south delhi", "hauz khas", "malviya nagar", "mehrauli"]],
  ["DL-RAV", "Rouse Avenue Courts", "Central Delhi", "Delhi", 28.637, 77.24, ["ito"]],
  // ── Maharashtra ──
  ["MH-MUMC", "City Civil & Sessions Court, Mumbai", "Mumbai City", "Maharashtra", 18.931, 72.833, ["mumbai", "bombay", "fort", "colaba", "south mumbai"]],
  ["MH-MUMS", "Courts at Bandra (Mumbai Suburban)", "Mumbai Suburban", "Maharashtra", 19.058, 72.842, ["bandra", "andheri", "borivali", "kurla", "goregaon", "malad", "powai"]],
  ["MH-THN", "District & Sessions Court, Thane", "Thane", "Maharashtra", 19.197, 72.963, ["thane", "mira road", "bhiwandi"]],
  ["MH-KLN", "Civil & Criminal Courts, Kalyan", "Thane", "Maharashtra", 19.243, 73.13, ["kalyan", "dombivli", "ulhasnagar"]],
  ["MH-BLP", "Civil & Criminal Courts, CBD Belapur", "Thane", "Maharashtra", 19.019, 73.039, ["navi mumbai", "belapur", "vashi", "nerul", "panvel", "kharghar"]],
  ["MH-PUN", "District & Sessions Court, Pune", "Pune", "Maharashtra", 18.53, 73.853, ["pune", "poona", "shivajinagar", "pimpri", "chinchwad", "hinjewadi"]],
  ["MH-NAG", "District & Sessions Court, Nagpur", "Nagpur", "Maharashtra", 21.153, 79.084, ["nagpur"]],
  ["MH-NSK", "District & Sessions Court, Nashik", "Nashik", "Maharashtra", 19.998, 73.79, ["nashik", "nasik"]],
  ["MH-AUR", "District & Sessions Court, Chhatrapati Sambhajinagar", "Chhatrapati Sambhajinagar", "Maharashtra", 19.876, 75.343, ["aurangabad", "sambhajinagar"]],
  ["MH-KOP", "District & Sessions Court, Kolhapur", "Kolhapur", "Maharashtra", 16.705, 74.243, ["kolhapur"]],
  ["MH-SOL", "District & Sessions Court, Solapur", "Solapur", "Maharashtra", 17.66, 75.906, ["solapur", "sholapur"]],
  ["MH-AMR", "District & Sessions Court, Amravati", "Amravati", "Maharashtra", 20.932, 77.752, ["amravati"]],
  // ── Karnataka ──
  ["KA-BLR", "City Civil & Sessions Court, Bengaluru", "Bengaluru Urban", "Karnataka", 12.978, 77.585, ["bengaluru", "bangalore", "whitefield", "koramangala", "indiranagar", "jayanagar", "electronic city", "hsr layout", "marathahalli"]],
  ["KA-BLRR", "District & Sessions Court, Bengaluru Rural", "Bengaluru Rural", "Karnataka", 13.204, 77.709, ["devanahalli", "yelahanka"]],
  ["KA-MYS", "District & Sessions Court, Mysuru", "Mysuru", "Karnataka", 12.305, 76.655, ["mysuru", "mysore"]],
  ["KA-MNG", "District & Sessions Court, Mangaluru", "Dakshina Kannada", "Karnataka", 12.871, 74.843, ["mangaluru", "mangalore"]],
  ["KA-DWD", "District & Sessions Court, Dharwad", "Dharwad", "Karnataka", 15.459, 75.008, ["dharwad", "hubballi", "hubli"]],
  ["KA-BGM", "District & Sessions Court, Belagavi", "Belagavi", "Karnataka", 15.85, 74.498, ["belagavi", "belgaum"]],
  ["KA-KLB", "District & Sessions Court, Kalaburagi", "Kalaburagi", "Karnataka", 17.329, 76.835, ["kalaburagi", "gulbarga"]],
  // ── Tamil Nadu ──
  ["TN-CHN", "City Civil Court, Chennai", "Chennai", "Tamil Nadu", 13.087, 80.288, ["chennai", "madras", "t nagar", "adyar", "anna nagar", "velachery", "tambaram"]],
  ["TN-CGL", "District Court, Chengalpattu", "Chengalpattu", "Tamil Nadu", 12.692, 79.977, ["chengalpattu"]],
  ["TN-CBE", "District Court, Coimbatore", "Coimbatore", "Tamil Nadu", 11.002, 76.962, ["coimbatore", "kovai"]],
  ["TN-MDU", "District Court, Madurai", "Madurai", "Tamil Nadu", 9.925, 78.12, ["madurai"]],
  ["TN-TRY", "District Court, Tiruchirappalli", "Tiruchirappalli", "Tamil Nadu", 10.805, 78.686, ["tiruchirappalli", "trichy", "tiruchi"]],
  ["TN-SLM", "District Court, Salem", "Salem", "Tamil Nadu", 11.664, 78.146, ["salem"]],
  ["TN-TNV", "District Court, Tirunelveli", "Tirunelveli", "Tamil Nadu", 8.714, 77.757, ["tirunelveli"]],
  ["TN-VLR", "District Court, Vellore", "Vellore", "Tamil Nadu", 12.917, 79.133, ["vellore"]],
  // ── Telangana ──
  ["TG-HYD", "City Civil Court, Hyderabad", "Hyderabad", "Telangana", 17.371, 78.474, ["hyderabad", "secunderabad", "banjara hills", "hitech city", "gachibowli", "madhapur"]],
  ["TG-RRD", "District Court, Ranga Reddy (L.B. Nagar)", "Ranga Reddy", "Telangana", 17.35, 78.552, ["lb nagar", "ranga reddy", "rangareddy"]],
  ["TG-MDL", "District Court, Medchal-Malkajgiri", "Medchal-Malkajgiri", "Telangana", 17.63, 78.481, ["medchal", "malkajgiri", "kukatpally"]],
  ["TG-WGL", "District Court, Warangal", "Warangal", "Telangana", 17.968, 79.594, ["warangal", "hanamkonda"]],
  ["TG-KRM", "District Court, Karimnagar", "Karimnagar", "Telangana", 18.439, 79.129, ["karimnagar"]],
  ["TG-NZB", "District Court, Nizamabad", "Nizamabad", "Telangana", 18.672, 78.094, ["nizamabad"]],
  // ── Andhra Pradesh ──
  ["AP-VSP", "District Court, Visakhapatnam", "Visakhapatnam", "Andhra Pradesh", 17.687, 83.218, ["visakhapatnam", "vizag", "vishakhapatnam"]],
  ["AP-VJA", "Courts at Vijayawada", "NTR / Krishna", "Andhra Pradesh", 16.506, 80.648, ["vijayawada", "bezawada", "amaravati"]],
  ["AP-GNT", "District Court, Guntur", "Guntur", "Andhra Pradesh", 16.307, 80.437, ["guntur"]],
  ["AP-TPT", "Courts at Tirupati", "Tirupati", "Andhra Pradesh", 13.629, 79.419, ["tirupati"]],
  ["AP-NLR", "District Court, Nellore", "Nellore", "Andhra Pradesh", 14.443, 79.987, ["nellore"]],
  ["AP-KNL", "District Court, Kurnool", "Kurnool", "Andhra Pradesh", 15.828, 78.037, ["kurnool"]],
  ["AP-KKD", "District Court, Kakinada", "Kakinada", "Andhra Pradesh", 16.989, 82.247, ["kakinada"]],
  ["AP-ATP", "District Court, Anantapuramu", "Anantapuramu", "Andhra Pradesh", 14.682, 77.6, ["anantapur", "anantapuramu"]],
  // ── West Bengal ──
  ["WB-KOL", "City Civil Court, Kolkata", "Kolkata", "West Bengal", 22.57, 88.347, ["kolkata", "calcutta", "salt lake", "park street"]],
  ["WB-ALP", "District Court, Alipore", "South 24 Parganas", "West Bengal", 22.535, 88.331, ["alipore", "behala", "garia", "jadavpur"]],
  ["WB-BRS", "District Court, Barasat", "North 24 Parganas", "West Bengal", 22.723, 88.481, ["barasat", "dum dum", "new town", "rajarhat", "barrackpore"]],
  ["WB-HWH", "District Court, Howrah", "Howrah", "West Bengal", 22.588, 88.31, ["howrah"]],
  ["WB-HGL", "District Court, Hooghly (Chinsurah)", "Hooghly", "West Bengal", 22.9, 88.39, ["hooghly", "chinsurah", "serampore"]],
  ["WB-SLG", "Courts at Siliguri", "Darjeeling", "West Bengal", 26.727, 88.395, ["siliguri", "darjeeling"]],
  ["WB-ASN", "District Court, Asansol", "Paschim Bardhaman", "West Bengal", 23.683, 86.983, ["asansol", "durgapur"]],
  ["WB-BDN", "District Court, Bardhaman", "Purba Bardhaman", "West Bengal", 23.24, 87.869, ["bardhaman", "burdwan"]],
  // ── Uttar Pradesh ──
  ["UP-LKO", "District & Sessions Court, Lucknow", "Lucknow", "Uttar Pradesh", 26.847, 80.946, ["lucknow"]],
  ["UP-KNP", "District & Sessions Court, Kanpur Nagar", "Kanpur Nagar", "Uttar Pradesh", 26.449, 80.331, ["kanpur"]],
  ["UP-GZB", "District & Sessions Court, Ghaziabad", "Ghaziabad", "Uttar Pradesh", 28.669, 77.454, ["ghaziabad", "indirapuram", "vaishali"]],
  ["UP-GBN", "District & Sessions Court, Gautam Buddh Nagar", "Gautam Buddh Nagar", "Uttar Pradesh", 28.528, 77.494, ["noida", "greater noida", "gautam buddh nagar"]],
  ["UP-AGR", "District & Sessions Court, Agra", "Agra", "Uttar Pradesh", 27.177, 78.008, ["agra"]],
  ["UP-VNS", "District & Sessions Court, Varanasi", "Varanasi", "Uttar Pradesh", 25.318, 82.974, ["varanasi", "banaras", "benares", "kashi"]],
  ["UP-PRJ", "District & Sessions Court, Prayagraj", "Prayagraj", "Uttar Pradesh", 25.435, 81.846, ["prayagraj", "allahabad"]],
  ["UP-MRT", "District & Sessions Court, Meerut", "Meerut", "Uttar Pradesh", 28.985, 77.706, ["meerut"]],
  ["UP-BRL", "District & Sessions Court, Bareilly", "Bareilly", "Uttar Pradesh", 28.367, 79.432, ["bareilly"]],
  ["UP-ALG", "District & Sessions Court, Aligarh", "Aligarh", "Uttar Pradesh", 27.898, 78.088, ["aligarh"]],
  ["UP-GKP", "District & Sessions Court, Gorakhpur", "Gorakhpur", "Uttar Pradesh", 26.76, 83.373, ["gorakhpur"]],
  ["UP-MBD", "District & Sessions Court, Moradabad", "Moradabad", "Uttar Pradesh", 28.839, 78.773, ["moradabad"]],
  ["UP-SRE", "District & Sessions Court, Saharanpur", "Saharanpur", "Uttar Pradesh", 29.964, 77.546, ["saharanpur"]],
  ["UP-JHS", "District & Sessions Court, Jhansi", "Jhansi", "Uttar Pradesh", 25.448, 78.569, ["jhansi"]],
  ["UP-MTJ", "District & Sessions Court, Mathura", "Mathura", "Uttar Pradesh", 27.492, 77.674, ["mathura", "vrindavan"]],
  ["UP-AYD", "District & Sessions Court, Ayodhya", "Ayodhya", "Uttar Pradesh", 26.792, 82.199, ["ayodhya", "faizabad"]],
  // ── Haryana ──
  ["HR-GGN", "District & Sessions Court, Gurugram", "Gurugram", "Haryana", 28.459, 77.027, ["gurugram", "gurgaon", "dlf", "cyber city", "manesar"]],
  ["HR-FBD", "District & Sessions Court, Faridabad", "Faridabad", "Haryana", 28.408, 77.318, ["faridabad"]],
  ["HR-PKL", "District & Sessions Court, Panchkula", "Panchkula", "Haryana", 30.694, 76.861, ["panchkula"]],
  ["HR-AMB", "District & Sessions Court, Ambala", "Ambala", "Haryana", 30.378, 76.777, ["ambala"]],
  ["HR-KNL", "District & Sessions Court, Karnal", "Karnal", "Haryana", 29.686, 76.99, ["karnal"]],
  ["HR-HSR", "District & Sessions Court, Hisar", "Hisar", "Haryana", 29.149, 75.722, ["hisar", "hissar"]],
  ["HR-RTK", "District & Sessions Court, Rohtak", "Rohtak", "Haryana", 28.895, 76.607, ["rohtak"]],
  ["HR-PNP", "District & Sessions Court, Panipat", "Panipat", "Haryana", 29.391, 76.964, ["panipat"]],
  ["HR-SNP", "District & Sessions Court, Sonipat", "Sonipat", "Haryana", 28.993, 77.019, ["sonipat", "sonepat"]],
  // ── Punjab & Chandigarh ──
  ["CH-CHD", "District Courts, Chandigarh (Sector 43)", "Chandigarh", "Chandigarh", 30.718, 76.775, ["chandigarh", "tricity"]],
  ["PB-MOH", "District & Sessions Court, SAS Nagar (Mohali)", "SAS Nagar", "Punjab", 30.705, 76.718, ["mohali", "sas nagar", "zirakpur", "kharar"]],
  ["PB-LDH", "District & Sessions Court, Ludhiana", "Ludhiana", "Punjab", 30.901, 75.857, ["ludhiana"]],
  ["PB-ASR", "District & Sessions Court, Amritsar", "Amritsar", "Punjab", 31.634, 74.872, ["amritsar"]],
  ["PB-JAL", "District & Sessions Court, Jalandhar", "Jalandhar", "Punjab", 31.326, 75.576, ["jalandhar", "jullundur"]],
  ["PB-PTL", "District & Sessions Court, Patiala", "Patiala", "Punjab", 30.34, 76.386, ["patiala"]],
  ["PB-BTI", "District & Sessions Court, Bathinda", "Bathinda", "Punjab", 30.211, 74.945, ["bathinda", "bhatinda"]],
  // ── Rajasthan ──
  ["RJ-JPR", "District & Sessions Court, Jaipur", "Jaipur", "Rajasthan", 26.912, 75.787, ["jaipur", "pink city"]],
  ["RJ-JDH", "District & Sessions Court, Jodhpur", "Jodhpur", "Rajasthan", 26.238, 73.024, ["jodhpur"]],
  ["RJ-UDR", "District & Sessions Court, Udaipur", "Udaipur", "Rajasthan", 24.585, 73.712, ["udaipur"]],
  ["RJ-KOT", "District & Sessions Court, Kota", "Kota", "Rajasthan", 25.213, 75.864, ["kota"]],
  ["RJ-AJM", "District & Sessions Court, Ajmer", "Ajmer", "Rajasthan", 26.45, 74.64, ["ajmer"]],
  ["RJ-BKN", "District & Sessions Court, Bikaner", "Bikaner", "Rajasthan", 28.022, 73.312, ["bikaner"]],
  ["RJ-ALW", "District & Sessions Court, Alwar", "Alwar", "Rajasthan", 27.553, 76.635, ["alwar"]],
  // ── Gujarat ──
  ["GJ-AMD", "City Civil & Sessions Court, Ahmedabad", "Ahmedabad", "Gujarat", 23.024, 72.58, ["ahmedabad", "amdavad", "navrangpura", "satellite"]],
  ["GJ-GNR", "District Court, Gandhinagar", "Gandhinagar", "Gujarat", 23.216, 72.637, ["gandhinagar"]],
  ["GJ-SRT", "District Court, Surat", "Surat", "Gujarat", 21.17, 72.831, ["surat"]],
  ["GJ-VDR", "District Court, Vadodara", "Vadodara", "Gujarat", 22.307, 73.181, ["vadodara", "baroda"]],
  ["GJ-RJT", "District Court, Rajkot", "Rajkot", "Gujarat", 22.303, 70.802, ["rajkot"]],
  ["GJ-BVN", "District Court, Bhavnagar", "Bhavnagar", "Gujarat", 21.764, 72.152, ["bhavnagar"]],
  ["GJ-JMN", "District Court, Jamnagar", "Jamnagar", "Gujarat", 22.47, 70.058, ["jamnagar"]],
  // ── Madhya Pradesh ──
  ["MP-BPL", "District & Sessions Court, Bhopal", "Bhopal", "Madhya Pradesh", 23.259, 77.413, ["bhopal"]],
  ["MP-IDR", "District & Sessions Court, Indore", "Indore", "Madhya Pradesh", 22.72, 75.858, ["indore"]],
  ["MP-JBP", "District & Sessions Court, Jabalpur", "Jabalpur", "Madhya Pradesh", 23.182, 79.987, ["jabalpur"]],
  ["MP-GWL", "District & Sessions Court, Gwalior", "Gwalior", "Madhya Pradesh", 26.218, 78.182, ["gwalior"]],
  ["MP-UJN", "District & Sessions Court, Ujjain", "Ujjain", "Madhya Pradesh", 23.18, 75.785, ["ujjain"]],
  // ── Chhattisgarh ──
  ["CG-RPR", "District & Sessions Court, Raipur", "Raipur", "Chhattisgarh", 21.251, 81.63, ["raipur"]],
  ["CG-BSP", "District & Sessions Court, Bilaspur", "Bilaspur", "Chhattisgarh", 22.08, 82.148, ["bilaspur"]],
  ["CG-DRG", "District & Sessions Court, Durg", "Durg", "Chhattisgarh", 21.19, 81.284, ["durg", "bhilai"]],
  // ── Bihar ──
  ["BR-PAT", "Civil Court, Patna", "Patna", "Bihar", 25.594, 85.138, ["patna"]],
  ["BR-GAY", "Civil Court, Gaya", "Gaya", "Bihar", 24.796, 85.008, ["gaya", "bodh gaya"]],
  ["BR-MZP", "Civil Court, Muzaffarpur", "Muzaffarpur", "Bihar", 26.121, 85.391, ["muzaffarpur"]],
  ["BR-BGP", "Civil Court, Bhagalpur", "Bhagalpur", "Bihar", 25.244, 86.972, ["bhagalpur"]],
  ["BR-DBG", "Civil Court, Darbhanga", "Darbhanga", "Bihar", 26.152, 85.897, ["darbhanga"]],
  // ── Jharkhand ──
  ["JH-RNC", "Civil Court, Ranchi", "Ranchi", "Jharkhand", 23.344, 85.31, ["ranchi"]],
  ["JH-JSR", "Civil Court, Jamshedpur", "East Singhbhum", "Jharkhand", 22.805, 86.203, ["jamshedpur", "tatanagar"]],
  ["JH-DHN", "Civil Court, Dhanbad", "Dhanbad", "Jharkhand", 23.796, 86.43, ["dhanbad"]],
  ["JH-BKR", "Civil Court, Bokaro", "Bokaro", "Jharkhand", 23.669, 86.151, ["bokaro"]],
  // ── Odisha ──
  ["OD-BBS", "District Court, Khordha (Bhubaneswar)", "Khordha", "Odisha", 20.296, 85.825, ["bhubaneswar", "khordha", "khurda"]],
  ["OD-CTC", "District Court, Cuttack", "Cuttack", "Odisha", 20.462, 85.883, ["cuttack"]],
  ["OD-BAM", "District Court, Ganjam (Berhampur)", "Ganjam", "Odisha", 19.315, 84.793, ["berhampur", "brahmapur", "ganjam"]],
  ["OD-SBP", "District Court, Sambalpur", "Sambalpur", "Odisha", 21.467, 83.982, ["sambalpur"]],
  // ── Kerala ──
  ["KL-EKM", "District Court, Ernakulam", "Ernakulam", "Kerala", 9.982, 76.284, ["kochi", "cochin", "ernakulam", "kakkanad", "aluva"]],
  ["KL-TVM", "District Court, Thiruvananthapuram", "Thiruvananthapuram", "Kerala", 8.524, 76.936, ["thiruvananthapuram", "trivandrum"]],
  ["KL-KKD", "District Court, Kozhikode", "Kozhikode", "Kerala", 11.258, 75.78, ["kozhikode", "calicut"]],
  ["KL-TSR", "District Court, Thrissur", "Thrissur", "Kerala", 10.527, 76.214, ["thrissur", "trichur"]],
  ["KL-KLM", "District Court, Kollam", "Kollam", "Kerala", 8.893, 76.614, ["kollam", "quilon"]],
  ["KL-KNR", "District Court, Kannur (Thalassery)", "Kannur", "Kerala", 11.874, 75.37, ["kannur", "cannanore", "thalassery"]],
  ["KL-KTM", "District Court, Kottayam", "Kottayam", "Kerala", 9.592, 76.522, ["kottayam"]],
  ["KL-PKD", "District Court, Palakkad", "Palakkad", "Kerala", 10.787, 76.654, ["palakkad", "palghat"]],
  ["KL-MLP", "District Court, Manjeri (Malappuram)", "Malappuram", "Kerala", 11.12, 76.12, ["malappuram", "manjeri"]],
  // ── Assam & North-East ──
  ["AS-GHY", "District Court, Kamrup (Metro), Guwahati", "Kamrup Metro", "Assam", 26.184, 91.746, ["guwahati", "gauhati", "dispur"]],
  ["AS-DBR", "District Court, Dibrugarh", "Dibrugarh", "Assam", 27.472, 94.912, ["dibrugarh"]],
  ["AS-SLC", "District Court, Cachar (Silchar)", "Cachar", "Assam", 24.833, 92.779, ["silchar"]],
  ["MN-IMP", "District Court, Imphal West", "Imphal West", "Manipur", 24.808, 93.938, ["imphal"]],
  ["ML-SHL", "District Court, East Khasi Hills (Shillong)", "East Khasi Hills", "Meghalaya", 25.578, 91.893, ["shillong"]],
  ["MZ-AIZ", "District Court, Aizawl", "Aizawl", "Mizoram", 23.727, 92.718, ["aizawl"]],
  ["NL-KOH", "District Court, Kohima", "Kohima", "Nagaland", 25.674, 94.11, ["kohima"]],
  ["NL-DMP", "District Court, Dimapur", "Dimapur", "Nagaland", 25.906, 93.727, ["dimapur"]],
  ["TR-AGT", "District Court, West Tripura (Agartala)", "West Tripura", "Tripura", 23.831, 91.287, ["agartala"]],
  ["AR-ITN", "District Court, Papum Pare (Itanagar)", "Papum Pare", "Arunachal Pradesh", 27.084, 93.605, ["itanagar", "naharlagun"]],
  ["SK-GTK", "District Court, East Sikkim (Gangtok)", "Gangtok", "Sikkim", 27.338, 88.606, ["gangtok"]],
  // ── Hill States, J&K, Ladakh ──
  ["UK-DDN", "District & Sessions Court, Dehradun", "Dehradun", "Uttarakhand", 30.317, 78.032, ["dehradun", "mussoorie"]],
  ["UK-HDW", "District & Sessions Court, Haridwar", "Haridwar", "Uttarakhand", 29.946, 78.164, ["haridwar", "roorkee", "rishikesh"]],
  ["UK-NTL", "District & Sessions Court, Nainital", "Nainital", "Uttarakhand", 29.38, 79.464, ["nainital", "haldwani"]],
  ["UK-RDP", "District & Sessions Court, Udham Singh Nagar (Rudrapur)", "Udham Singh Nagar", "Uttarakhand", 28.975, 79.4, ["rudrapur", "kashipur"]],
  ["HP-SML", "District & Sessions Court, Shimla", "Shimla", "Himachal Pradesh", 31.104, 77.173, ["shimla", "simla"]],
  ["HP-DHM", "District & Sessions Court, Kangra (Dharamshala)", "Kangra", "Himachal Pradesh", 32.219, 76.323, ["dharamshala", "dharamsala", "kangra"]],
  ["HP-MND", "District & Sessions Court, Mandi", "Mandi", "Himachal Pradesh", 31.708, 76.932, ["mandi", "kullu", "manali"]],
  ["JK-SXR", "District Court, Srinagar", "Srinagar", "Jammu & Kashmir", 34.084, 74.797, ["srinagar"]],
  ["JK-JMU", "District Court, Jammu", "Jammu", "Jammu & Kashmir", 32.726, 74.857, ["jammu"]],
  ["LA-LEH", "District Court, Leh", "Leh", "Ladakh", 34.152, 77.577, ["leh", "ladakh"]],
  // ── Goa, UTs ──
  ["GA-PNJ", "District Court, North Goa (Panaji)", "North Goa", "Goa", 15.496, 73.828, ["panaji", "panjim", "mapusa", "north goa", "goa"]],
  ["GA-MRG", "District Court, South Goa (Margao)", "South Goa", "Goa", 15.276, 73.958, ["margao", "madgaon", "vasco", "south goa"]],
  ["PY-PDY", "District Court, Puducherry", "Puducherry", "Puducherry", 11.934, 79.83, ["puducherry", "pondicherry"]],
  ["AN-PBL", "District Court, Port Blair", "South Andaman", "Andaman & Nicobar Islands", 11.623, 92.726, ["port blair", "andaman"]],
  ["DN-SIL", "District Court, Silvassa", "Dadra & Nagar Haveli", "Dadra & Nagar Haveli and Daman & Diu", 20.274, 73.009, ["silvassa", "daman", "diu"]],
];

export interface CourtRecord {
  code: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export function courtRecords(): CourtRecord[] {
  return DISTRICT_COURTS.map(([code, name, district, state, lat, lng, aliases]) => ({
    code,
    name,
    district,
    state,
    lat,
    lng,
    aliases: aliases ?? [],
  }));
}

// ── Place recognition (gazetteer) ─────────────────────────────────────────────
// Turns "I live in Gurgaon" / "near Whitefield" into a point we can geo-match on. Built from the
// court aliases + district names. Longest alias wins ("new delhi" beats "delhi").
export interface Place {
  label: string;
  courtCode: string;
  lat: number;
  lng: number;
}

let GAZETTEER: { alias: string; place: Place }[] | null = null;

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function gazetteer(): { alias: string; place: Place }[] {
  if (GAZETTEER) return GAZETTEER;
  const out = new Map<string, Place>();
  for (const c of courtRecords()) {
    const names = new Set<string>([...c.aliases, c.district.toLowerCase()]);
    for (const raw of names) {
      const alias = raw.toLowerCase().trim();
      if (alias.length < 3 || out.has(alias)) continue; // first (most specific) court wins
      out.set(alias, { label: titleCase(alias), courtCode: c.code, lat: c.lat, lng: c.lng });
    }
  }
  GAZETTEER = [...out.entries()]
    .map(([alias, place]) => ({ alias, place }))
    .sort((a, b) => b.alias.length - a.alias.length);
  return GAZETTEER;
}

// Place names that are also everyday (often Hinglish) words — "paisa le gaya", "sabzi mandi".
// These only count when introduced as a place: "in Gaya", "near Mandi", "from Kota".
const AMBIGUOUS = new Set(["gaya", "mandi", "kota", "durg", "leh", "ito", "diu"]);
const PLACE_CUE = "(?:in|at|near|from|to|city|district|live|living|stay|staying|based|mein|me)";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find a known Indian place mentioned in free text. */
export function findPlace(text: string): Place | null {
  if (!text) return null;
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;
  for (const { alias, place } of gazetteer()) {
    const pat = AMBIGUOUS.has(alias)
      ? `\\s${PLACE_CUE}\\s${escapeRe(alias)}\\s`
      : `\\s${escapeRe(alias)}\\s`;
    if (new RegExp(pat).test(lower)) return place;
  }
  return null;
}

/** Resolve a typed city name ("Bangalore", "gurgaon ") to a place. */
export function resolveCity(city: string): Place | null {
  const q = city.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!q) return null;
  const exact = gazetteer().find((g) => g.alias === q);
  if (exact) return exact.place;
  return findPlace(q);
}

/** All recognisable city/area names, for autocomplete in the UI. */
export function knownCities(): string[] {
  return [...new Set(gazetteer().map((g) => g.place.label))].sort();
}
