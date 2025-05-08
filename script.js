// Constants and configuration
const SHEET_ID = '1tXVmhvaNf9vClVWidGftayzfFK3ZThGhBu1d93BzOrw';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Global data storage
let allData = [];
let ctx = null; // Canvas context for chart
let chart = null; // Chart instance

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM Elements after page is fully loaded
    const currentDateEl = document.getElementById('currentDate');
    const todayTableBodyEl = document.getElementById('todayTableBody');
    const totalAmountEl = document.getElementById('totalAmount');
    const weeklyTrendChartEl = document.getElementById('weeklyTrendChart');
    const totalMMEl = document.getElementById('totalMM');
    const totalPREEl = document.getElementById('totalPRE');
    
    // Update the current date display
    function updateCurrentDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = now.toLocaleDateString(undefined, options);
    }
    
    // Display today's data in the table
    function displayTodayData(todayData) {
        // Clear existing table rows
        todayTableBodyEl.innerHTML = '';
        
        if (todayData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="4" style="text-align: center;">No data for today</td>';
            todayTableBodyEl.appendChild(row);
            totalAmountEl.textContent = '0 ml';
            return;
        }
        
        // Calculate total amount
        let totalAmount = 0;
        
        // Add rows for each feeding
        todayData.forEach(feeding => {
            const row = document.createElement('tr');
            
            // Format time (HH:MM)
            const timeStr = feeding.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            row.innerHTML = `
                <td>${timeStr}</td>
                <td>${feeding.amount} ml</td>
                <td>${feeding['What Milk']}</td>
                <td>${feeding['Boob']}</td>
            `;
            
            todayTableBodyEl.appendChild(row);
            totalAmount += feeding.amount;
        });
        
        // Update total amount
        totalAmountEl.textContent = `${totalAmount} ml`;
    }
    
    // Display weekly trend chart
    function displayWeeklyTrend(weeklyData) {
        // Group data by day and milk type using a consistent date formatting approach
        const dailyData = {};
        
        weeklyData.forEach(row => {
            // Create a date-only string in YYYY-MM-DD format for consistent grouping
            const date = new Date(row.date);
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            
            // Create a new date with just Y-M-D components (no time)
            const dateKey = new Date(year, month, day).toISOString().split('T')[0];
            
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    MM: 0,
                    PRE: 0,
                    total: 0,
                    date: new Date(year, month, day) // Store normalized date
                };
            }
            
            // Add to the appropriate milk type
            if (row['What Milk'] === 'MM') {
                dailyData[dateKey].MM += row.amount;
            } else if (row['What Milk'] === 'PRE') {
                dailyData[dateKey].PRE += row.amount;
            }
            
            // Add to the total
            dailyData[dateKey].total += row.amount;
        });
        
        // Sort the dates chronologically
        const sortedKeys = Object.keys(dailyData).sort();
        
        // Convert to arrays for chart using sorted keys
        const mmData = sortedKeys.map(date => dailyData[date].MM);
        const preData = sortedKeys.map(date => dailyData[date].PRE);
        const totalData = sortedKeys.map(date => dailyData[date].total);
        const dateObjects = sortedKeys.map(date => dailyData[date].date);
        
        // Create or update chart
        if (!ctx) {
            ctx = weeklyTrendChartEl.getContext('2d');
        }
        
        // Destroy previous chart if it exists
        if (chart) {
            chart.destroy();
        }
        
        // Create new chart with stacked bars
        chart = createStackedChart(ctx, sortedKeys, mmData, preData, totalData, dateObjects);
    }
    
    // Create a stacked bar chart
    function createStackedChart(ctx, labels, mmData, preData, totalData, dateObjects) {
        // Format dates for better display using the actual date objects
        const formattedLabels = dateObjects.map(date => {
            // Use a fixed format that works consistently across devices
            const day = date.getDate();
            const month = date.toLocaleString('en-US', { month: 'short' });
            return `${day} ${month}`; // e.g. "8 May"
        });
        
        // Set canvas dimensions based on container
        const container = ctx.canvas.parentNode;
        ctx.canvas.width = container.clientWidth;
        ctx.canvas.height = container.clientHeight;
        
        // Find the maximum value for scaling
        const maxValue = Math.max(...totalData) * 1.2; // 20% padding on top
        
        // Clear canvas
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Set chart padding
        const padding = {
            top: 20,
            right: 20,
            bottom: 40,
            left: 60
        };
        
        // Calculate chart area dimensions
        const chartWidth = ctx.canvas.width - padding.left - padding.right;
        const chartHeight = ctx.canvas.height - padding.top - padding.bottom;
        
        // Draw background grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        const numGridLines = 5;
        for (let i = 0; i <= numGridLines; i++) {
            const y = padding.top + chartHeight - (i / numGridLines) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
            
            // Add y-axis labels
            const value = Math.round((i / numGridLines) * maxValue);
            ctx.fillStyle = '#7f8c8d';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${value} ml`, padding.left - 10, y + 4);
        }
        
        // Draw bars
        const barWidth = chartWidth / labels.length * 0.6;
        const barSpacing = chartWidth / labels.length * 0.4 / 2;
        
        // Colors for milk types
        const mmColor = '#e74c3c'; // Red for MM
        const preColor = '#2ecc71'; // Green for PRE
        
        totalData.forEach((total, index) => {
            const mm = mmData[index];
            const pre = preData[index];
            
            // Calculate heights proportional to the chart
            const mmHeight = (mm / maxValue) * chartHeight;
            const preHeight = (pre / maxValue) * chartHeight;
            
            // Calculate positions
            const x = padding.left + index * (barWidth + 2 * barSpacing) + barSpacing;
            let y = padding.top + chartHeight;
            
            // Draw PRE bar (bottom part)
            if (pre > 0) {
                y -= preHeight;
                ctx.fillStyle = preColor;
                ctx.fillRect(x, y, barWidth, preHeight);
            }
            
            // Draw MM bar (top part)
            if (mm > 0) {
                y -= mmHeight;
                ctx.fillStyle = mmColor;
                ctx.fillRect(x, y, barWidth, mmHeight);
            }
            
            // Add total value on top of bar
            ctx.fillStyle = '#2c3e50';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            
            // Only show total if there is data
            if (total > 0) {
                ctx.fillText(total, x + barWidth / 2, y - 5);
            }
            
            // Add x-axis label
            ctx.fillStyle = '#7f8c8d';
            ctx.textAlign = 'center';
            ctx.fillText(formattedLabels[index], x + barWidth / 2, padding.top + chartHeight + 20);
        });
        
        // Add legend
        const legendY = padding.top - 5;
        const legendSquareSize = 10;
        
        // MM legend
        ctx.fillStyle = mmColor;
        ctx.fillRect(padding.left, legendY, legendSquareSize, legendSquareSize);
        ctx.fillStyle = '#555';
        ctx.textAlign = 'left';
        ctx.fillText('MM', padding.left + legendSquareSize + 5, legendY + 8);
        
        // PRE legend
        const mmTextWidth = ctx.measureText('MM').width;
        const preX = padding.left + legendSquareSize + 10 + mmTextWidth + 20;
        ctx.fillStyle = preColor;
        ctx.fillRect(preX, legendY, legendSquareSize, legendSquareSize);
        ctx.fillStyle = '#555';
        ctx.fillText('PRE', preX + legendSquareSize + 5, legendY + 8);
        
        return {
            destroy: function() {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        };
    }
    
    // Update statistics by milk type
    function updateStats(todayData, weeklyData) {
        // Calculate totals by milk type for today
        let totalMM = 0;
        let totalPRE = 0;
        
        todayData.forEach(row => {
            if (row['What Milk'] === 'MM') {
                totalMM += row.amount;
            } else if (row['What Milk'] === 'PRE') {
                totalPRE += row.amount;
            }
        });
        
        // Update the stat boxes
        totalMMEl.textContent = `${totalMM} ml`;
        totalPREEl.textContent = `${totalPRE} ml`;
    }
    
    // Process the fetched data
    function processData() {
        if (!allData || allData.length === 0) {
            console.warn('No data available to process');
            return;
        }
        
        // Convert string dates to Date objects and ensure "How Much" is numeric
        allData.forEach(row => {
            // Parse the date (assuming format DD.MM.YYYY HH:MM:SS)
            const [datePart, timePart] = row['Datetimestamp'].split(' ');
            const [day, month, year] = datePart.split('.');
            const [hours, minutes, seconds] = timePart ? timePart.split(':') : [0, 0, 0];
            
            row.date = new Date(year, month - 1, day, hours, minutes, seconds);
            row.amount = parseInt(row['How Much'], 10) || 0;
        });
        
        // Sort by date (newest first)
        allData.sort((a, b) => b.date - a.date);
        
        // Get today's data
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayData = allData.filter(row => {
            const rowDate = new Date(row.date);
            rowDate.setHours(0, 0, 0, 0);
            return rowDate.getTime() === today.getTime();
        });
        
        // Display today's data in the table
        displayTodayData(todayData);
        
        // Get the last 7 days of data for the weekly trend
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        
        const weeklyData = allData.filter(row => row.date >= weekAgo);
        
        // Display weekly trend chart
        displayWeeklyTrend(weeklyData);
        
        // Update stats
        updateStats(todayData, weeklyData);
    }
    
    // Parse CSV text into structured data
    function parseCSV(csvText) {
        // Split by lines and remove empty lines
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        // Extract headers (first line)
        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
        
        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
            
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }
        
        return data;
    }
    
    // Fetch data from Google Sheet
    async function fetchData() {
        try {
            // Show loading indicators
            document.querySelectorAll('.loading').forEach(el => el.style.display = 'block');
            
            // Fetch the CSV data
            const response = await fetch(SHEET_URL);
            
            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }
            
            const csvText = await response.text();
            allData = parseCSV(csvText);
            
            // Process and display the data
            processData();
            
            // Hide loading indicators
            document.querySelectorAll('.loading').forEach(el => el.style.display = 'none');
            
        } catch (error) {
            console.error('Error fetching or processing data:', error);
            alert('There was an error getting the latest data. Please try again later.');
        }
    }
    
    // Initialize the app
    updateCurrentDate();
    fetchData();
    
    // Set up refresh interval
    setInterval(fetchData, REFRESH_INTERVAL);
});