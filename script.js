// Constants and configuration
const SHEET_ID = '1tXVmhvaNf9vClVWidGftayzfFK3ZThGhBu1d93BzOrw';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// DOM Elements
const currentDateEl = document.getElementById('currentDate');
const todayTableBodyEl = document.getElementById('todayTableBody');
const totalAmountEl = document.getElementById('totalAmount');
const weeklyTrendChartEl = document.getElementById('weeklyTrendChart');
const dailyAverageEl = document.getElementById('dailyAverage');
const mostRecentEl = document.getElementById('mostRecent');
const refreshButtonEl = document.getElementById('refreshButton');

// Global data storage
let allData = [];
let ctx = null; // Canvas context for chart
let chart = null; // Chart instance

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    updateCurrentDate();
    fetchData();
    
    // Set up refresh interval
    setInterval(fetchData, REFRESH_INTERVAL);
    
    // Set up refresh button
    refreshButtonEl.addEventListener('click', fetchData);
});

// Update the current date display
function updateCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString(undefined, options);
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
    // Group data by day and calculate total amount per day
    const dailyTotals = {};
    
    weeklyData.forEach(row => {
        const dateStr = row.date.toLocaleDateString();
        if (!dailyTotals[dateStr]) {
            dailyTotals[dateStr] = 0;
        }
        dailyTotals[dateStr] += row.amount;
    });
    
    // Convert to arrays for chart
    const labels = Object.keys(dailyTotals);
    const data = Object.values(dailyTotals);
    
    // Create or update chart
    if (!ctx) {
        ctx = weeklyTrendChartEl.getContext('2d');
    }
    
    // Destroy previous chart if it exists
    if (chart) {
        chart.destroy();
    }
    
    // Create new chart
    chart = createChart(ctx, labels, data);
}

// Create a chart
function createChart(ctx, labels, data) {
    // Format dates for better display
    const formattedLabels = labels.map(dateStr => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    
    // Set canvas dimensions based on container
    const container = ctx.canvas.parentNode;
    ctx.canvas.width = container.clientWidth;
    ctx.canvas.height = container.clientHeight;
    
    // Draw chart
    const maxValue = Math.max(...data) * 1.2; // 20% padding on top
    
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
    const barWidth = chartWidth / data.length * 0.6;
    const barSpacing = chartWidth / data.length * 0.4 / 2;
    
    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding.left + index * (barWidth + 2 * barSpacing) + barSpacing;
        const y = padding.top + chartHeight - barHeight;
        
        // Draw bar
        ctx.fillStyle = '#3498db';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Add value on top of bar
        ctx.fillStyle = '#2c3e50';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(value, x + barWidth / 2, y - 5);
        
        // Add x-axis label
        ctx.fillStyle = '#7f8c8d';
        ctx.textAlign = 'center';
        ctx.fillText(formattedLabels[index], x + barWidth / 2, padding.top + chartHeight + 20);
    });
    
    return {
        destroy: function() {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    };
}

// Update statistics
function updateStats(todayData, weeklyData) {
    // Calculate daily average
    const dailyTotals = {};
    weeklyData.forEach(row => {
        const dateStr = row.date.toLocaleDateString();
        if (!dailyTotals[dateStr]) {
            dailyTotals[dateStr] = 0;
        }
        dailyTotals[dateStr] += row.amount;
    });
    
    const totalDays = Object.keys(dailyTotals).length;
    const totalAmount = Object.values(dailyTotals).reduce((sum, val) => sum + val, 0);
    const dailyAverage = totalDays > 0 ? Math.round(totalAmount / totalDays) : 0;
    
    dailyAverageEl.textContent = `${dailyAverage} ml`;
    
    // Most recent feeding
    if (allData.length > 0) {
        const mostRecent = allData[0];
        const timeAgo = getTimeAgo(mostRecent.date);
        mostRecentEl.textContent = `${mostRecent.amount} ml (${timeAgo})`;
    } else {
        mostRecentEl.textContent = 'No data';
    }
}

// Get a human-readable time ago string
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMinutes < 1) {
        return 'just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
}