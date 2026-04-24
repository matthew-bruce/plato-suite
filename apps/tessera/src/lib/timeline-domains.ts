export interface DomainConfig {
  name: string
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'SCOPED'
  resourceNames: string[]
}

// Domain groupings derived from the established Gantt v4 data.
// Replace with tessera_domain_resources DB query once that table is populated.
export const DOMAIN_CONFIG: DomainConfig[] = [
  {
    name: 'Programme & Leadership', risk: 'HIGH',
    resourceNames: [
      'Jonny Wooldridge', 'Matthew Bruce', 'Mark Dickson', 'Mike James', 'Paul Williams',
      'Ajmal Malik', 'Selen Hamilton',
      'James Taylor', 'Natalie Cole', 'Rajesh Dubey', 'Grant Bramley',
      'Sajesh Advilkar', 'Bharat Patil',
      'Mathivanan Pandurangan', 'David Enriquez', 'Devika Sangwan',
      'Pradibha Devendran', 'Prakash Shetty', 'Bhagwat Gaikwad',
    ],
  },
  {
    name: 'Drupal / Legacy CMS', risk: 'HIGH',
    resourceNames: [
      'Vipul Suriya', 'Poornachandran Ramakrishnan', 'Anupama Rs', 'Margala Kumar',
      'Tushar Mohapatra', 'Sarath KP', 'Shriramnathan K',
    ],
  },
  {
    name: 'Camel / Integration + Zeus', risk: 'HIGH',
    resourceNames: [
      'Nick Walter', 'Nikhil Vibhav', 'Anupama Yadav',
      'Prapti Verma',
    ],
  },
  {
    name: 'Platform Engineering / DevOps', risk: 'HIGH',
    resourceNames: [
      'Paul Dixon',
      'Emil Nowak', 'Jakub Benzef', 'Jan Urbaniak',
    ],
  },
  {
    name: 'Azure Platform / Cloud', risk: 'HIGH',
    resourceNames: [
      'Emil Nowak', 'Mateusz Kowalewski', 'Maciej Cieslak',
    ],
  },
  {
    name: 'Magento / eCommerce', risk: 'MEDIUM',
    resourceNames: [
      'Hitendrasinh Rajput',
      'Marvania Vivek Sureshbhai', 'Sunil Kumar',
    ],
  },
  {
    name: 'ForgeRock / IAM', risk: 'SCOPED',
    resourceNames: [],
  },
  {
    name: 'Release Management', risk: 'HIGH',
    resourceNames: [
      'Makarand Parab', 'Shilpa Surve', 'Manasi Ketkar',
      'Savita Khatavkar', 'Tejaswini Patil',
      'Justin Fox',
    ],
  },
  {
    name: 'QA / Testing', risk: 'HIGH',
    resourceNames: [
      'Amol Tate', 'Nilesh Kumar', 'Praneeth Gudelli',
      'Arti Lamje', 'Dipti Chaudhari', 'Praneetha Bandlamudi',
      'Priyanka Dhole', 'Shruti Shukla', 'Yashvanth C',
      'Anjusmita Choudhury', 'Dipti Devanga',
      'Grzegorz Bech',
    ],
  },
  {
    name: 'Analytics', risk: 'LOW',
    resourceNames: [
      'Rajat Pandey',
      'Henna Maria Sha', 'Vinita Kalidas Marathe',
      'Najam Khan-Muztar',
    ],
  },
  {
    name: 'Delivery & Product', risk: 'MEDIUM',
    resourceNames: [
      'Daniel Chambers', 'Dat Ly', 'Virginie Tan', 'Mohit Porwal',
    ],
  },
  {
    name: 'React / Frontend', risk: 'MEDIUM',
    resourceNames: [
      'Leopold Kwok', 'Christopher Palmer',
      'Adam Dobrzeniewski', 'Krzysztof Derek',
      'Vishal V',
    ],
  },
  {
    name: 'Security', risk: 'MEDIUM',
    resourceNames: [
      'Tom Tanser', 'Zouhir Saad-Saoud',
    ],
  },
  {
    name: 'Service Management', risk: 'HIGH',
    resourceNames: [
      'Clare Dean', 'Mandy Tucker',
    ],
  },
]
