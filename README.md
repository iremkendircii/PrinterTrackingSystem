Printer Toner Tracking System

This project is a web application developed to track the toner levels and statuses of network printers.

🚀 Features
✅ Completed Features

Add Printer

When clicking the "Add Printer" button, the entered IP address is appended to ips.txt

Automatically validates new printers when added

Manual Refresh

Clicking the "Refresh" button runs downloadAll.js and generateSummary.js

Retrieves the latest data from all printers

Automatic Refresh

Backend automatically refreshes every 5 minutes

Real-time notifications for critical toner levels

Real-Time Update

Frontend updates "Last Seen" time with Socket.io

Format: DD/MM/YYYY HH:MM

Notification System

Browser notifications for critical toner levels

Toast messages for user feedback

📁 File Structure
PRINTER TRACKING SYSTEM/
├── server.js             # Server startup file
├── ips.txt               # Printer IP addresses and names
├── package.json          # Project dependencies
├── package-lock.json     # Dependency lock file
├── README.md             # Project documentation
├── summary.csv           # Summary of printer data
├── json_outputs/         # JSON data for each printer
├── public/               # Frontend files
│   ├── css/
│   │   └── style.css     # Stylesheet
│   ├── js/
│   │   └── app.js        # Frontend JS file
│   ├── index.html        # Main frontend page
│   └── login.html        # Login page
├── routes/
│   └── printerRoutes.js  # Printer API routes
└── utils/
    ├── downloadAll.js    # Fetch data from all IPs
    └── generateSummary.js # Generate CSV summary

🛠️ Installation

Install dependencies:

npm install


Start the application:

node server.js


Open in browser:

http://localhost:3000

🔧 Usage

Add Printer

Enter the IP address and printer name

Click "Add Printer"

Printer is automatically added to ips.txt and data is retrieved

Manual Refresh

Click "Refresh"

Retrieves updated data from all printers

Frontend updates automatically

Automatic Refresh

Runs every 5 minutes

Notifies about changes in critical toner levels

📊 Data Formats

ips.txt Format

192.168.1.100 - Printer Name
192.168.1.101 - Another Printer


JSON Output Format

{
  "ip": "192.168.1.100",
  "unit": "Printer Name",
  "lastModified": "2024-01-01T12:00:00.000Z",
  "black": 85,
  "cyan": 70,
  "magenta": 60,
  "yellow": 45,
  "serialNo": "ABC123456"
}

🔔 Notifications

Critical Toner: Toner levels below 2%

Offline Printers: Printers with no data for 30 minutes

Automatic Refresh: Every 5 minutes

🎯 Technologies

Backend: Node.js, Express.js

Frontend: HTML, CSS, JavaScript

Real-Time: Socket.io

HTTP Requests: Axios

File Operations: Node.js fs module

📝 Notes

Printers’ web interfaces must be enabled

IP addresses must follow the correct format (xxx.xxx.xxx.xxx)

Network access is required

Critical toner threshold is set at 2%

🚨 Troubleshooting

Printer access error: Make sure the printer is powered on

Invalid IP address: Verify the IP format is correct

Connection refused: Ensure the printer’s web interface is accessible

📞 Support

If you encounter issues, please check:

The printer IP address

Network connectivity

Printer power status

Accessibility of the printer’s web interface
