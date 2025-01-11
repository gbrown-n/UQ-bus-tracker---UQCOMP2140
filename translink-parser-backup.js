/*
FileName: translink-parser.js
Author: Gabriel Brown 
StudentID: 4641121

COMP2140 Assignment 1:
Node.js application to search bus routes at UQ Lakes in the next ten minutes. 
*/

/*Dependencies*/
import promptSync from "prompt-sync";
const prompt = promptSync({
    sigint: false
});
import fetch from "node-fetch";
import { parse } from 'csv-parse/sync';
import fs from 'fs';

/*Constants*/
const GREETING = "Welcome to the UQ Lakes station bus tracker!";
const SEARCH = "Would you like to search again?: ";
const GOODBYE = "Thanks for using the UQ Lakes station bus tracker!";

const PROMPT_DATE = "What date will you depart UQ Lakes station by bus? (YYYY-MM-DD): ";
const ERR_DATE = "Incorrect date format. Please use YYYY-MM-DD.";

const PROMPT_TIME = "What time will you depart UQ Lakes station by bus? (HH:mm): ";
const ERR_TIME = "Incorrect time format. Please use HH:mm.";

const PROMPT_ROUTE = `What Bus Route would you like to take?
1 - Show All Routes 
2 - 66 
3 - 192
4 - 169 
5 - 209
6 - 29
7 - P332
8 - 139
9 - 28\n`;
const ERR_ROUTE = "Please enter a valid option for a bus route.";

const PROMPT_SEARCH = "Would you like to search again? (y/n or yes/no): "
const ERR_SEARCH = "Please enter a valid option."

const URL_TRIP = "http://127.0.0.1:5343/gtfs/seq/trip_updates.json";
const URL_VEHICLE = "http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json";
const URL_ALERT = "http://127.0.0.1:5343/gtfs/seq/alerts.json";

const UQ_STOPS = ['1853','1878','1882','1947'];
const VALID_ROUTES = ["Show All Routes", "66", "192", "169", "209", "29", "P332", "139", "28"];
const VALID_ROUTE_INPUTS = ['1','2','3','4','5','6','7','8','9']

async function main() {

    let print = (message) => console.log(message);
     
    async function start() {
        const tripData = await fetchData(URL_TRIP);
        const vehicleData = await fetchData(URL_VEHICLE);
        saveCache("trip", tripData);
        saveCache("vehicle", vehicleData)
        print(GREETING)
    };

    /*
     * Function that handles the end-loop of the program. i.e after a search has been performed, 
     * prompt the user for an input, asking if they wish to search again. 
     * This second search will be performed with the cached data. 
     * Returns - calls self again if user provides invalid input, ensuring loop until valid input
     * is returned.
    */
    function end() {
        let opt = prompt(PROMPT_SEARCH);
        if (opt === 'y' || opt === 'yes') {
            search();
        }
        else if (opt === 'n' || opt === 'no') {
            print(GOODBYE);
            return;
        }

        else {
            print(ERR_SEARCH);
            end();
        }
    }

    /**
     * This function fetches data asynchronously based on the URL provided.
     * @param {string} url - the URL to fetch data from (expecting JSON).
     * @returns {string} the JSON response.
     * 
     * Taken from wk4 contact session
     */
    async function fetchData(url) {
        //print(`Getting ${url}...`); //debugging
        const response = await fetch(url);
        const responseJSON = await response.json();
        return responseJSON;
    }


    /*
    Taken from wk4 lecture code
    */
    const prompt = promptSync({sigint: true});

    const parseCSV = (file) => {
        //print(`Getting ${file}...`) //debugging
        const data = fs.readFileSync(file,'utf8');
            return parse(data, {
                columns: true
                })

    }

    
    /*
     * Inline arrow function used to define the string format of the cached data file.
    */
    const jsonFilename = (append) => `cached-data/translink-${append}.json`;

    //fixed with refernece to ws schools : https://www.w3schools.com/nodejs/nodejs_filesystem.asp
    function saveCache(filenameAppend, data) {
            fs.writeFileSync(jsonFilename(filenameAppend), JSON.stringify(data), { encoding: 'utf8'})
    }

    /**
     * This function will read a JSON cache file with the specified filename.
     * @param {string} filenameAppend - The string to append to the JSON filename.
     * @returns {string} the JSON data from the cache file.
     */
    function readCache(filenameAppend) {
            return JSON.parse(fs.readFileSync(jsonFilename(filenameAppend),{ encoding: 'utf8'})).entity;
        };

    /**
     * This function is used to load all relevant CSV and JSON data, and parse the search terms into the relevant search 
     * functions. 
     * As this function is asynchronous, all data handling must be performed in the function callbacks. (ie it is not possible
     * to return the data from the function). Therefore the filter and search actually occurs within the 'data load'. 
     * 
     * @param {string} routeInput - validated selected input route: one of items in VALID_ROUTES
     * @param {string} dateInput  - validated selected input date, in format YYYY-MM-dd
     * @param {string} timeInput  - validated selected input time, in format HH:mm
     * @returns {none} - outputs table to console.table()
     */
    async function loadData(routeInput, dateInput, timeInput) {
        let selectedDate = new Date(dateInput);
        //print(selectedDate);
        //print(selectedDate.valueOf);
        let currentDay = (selectedDate.getDay() - 1) % 7;


        //parse static csv files

        //uqStops - array containing information from stops.txt ONLY for UQ stops
        const stops = await parseCSV("static-data/stops.txt");
        const uqStops = stops.filter(stop => UQ_STOPS.includes(stop.stop_id));
        const uqStopIds = uqStops.map(x => x.stop_id);

        //uqStopTimes - array containing information from stop_times.txt ONLY for UQ stops
        const stopTimes = await parseCSV("static-data/stop_times.txt");
        const uqStopTimes = stopTimes.filter(stop_time => uqStopIds.includes(stop_time.stop_id) && stop_time.pickup_type == '0'); //not working?
        const uqTripIds = uqStopTimes.map(x => x.trip_id);

        //uqTrips - array containing information from trips.txt ONLY for trips headed to UQ stops
        const trips = await parseCSV("static-data/trips.txt");
        let uqTrips = trips.filter(trip => uqTripIds.includes(trip.trip_id));

        //uq Calendar - array containing calendar information (ie weekly boolean timetable) for services ONLY to UQ stops
        const calendar = await parseCSV("static-data/calendar.txt");
        let uqCalendar = calendar.filter(service => uqTrips.map(trip => trip.service_id).includes(service.service_id));
        const uqCalendardays = uqCalendar.filter(service => {
            const days = [service.monday, service.tuesday, service.wednesday, service.thursday, service.friday, service.saturday, service.sunday];
            
            //this date is parsing incorrectly
            let serviceStartDateString = service.start_date.slice(0,4) + '-' + service.start_date.slice(4,6) + '-' + service.start_date.slice(6);
            //print(serviceDateString);
            let serviceStartDate = new Date(serviceStartDateString);
            //print(serviceStartDate);

            let serviceEndDateString = service.end_date.slice(0,4) + '-' + service.end_date.slice(4,6) + '-' + service.end_date.slice(6);
            let serviceEndDate = new Date(serviceEndDateString);
            //print(serviceEndDate);
            if (days[currentDay] === '1' && selectedDate.valueOf() >= serviceStartDate.valueOf() && selectedDate.valueOf() <= serviceEndDate.valueOf()) { 
                return true;//&& selectedDate >= serviceStartDate && selectedDate <= endDate
            } else {
                return false;
        }});

        //filter UQ trips by the union of uqTrips and uqCalendar - filters, but only 9 out of the 11 or 12 ? 
        uqTrips = uqTrips.filter(trip => uqCalendardays.map(x=>x.service_id).includes(trip.service_id));
        const uqRouteIds = uqTrips.map(x => x.route_id);

        //uqRoutes - information from routes.txt ONLY for UQ services.
        const routes = await parseCSV("static-data/routes.txt");
        const uqRoutes = routes.filter(route => uqRouteIds.includes(route.route_id));

        //searchedData - the output search data to be sent to output (should make this a seperate func)
        const searchedData = search_data(dateInput, timeInput, routeInput);

        //output - the merged searchedData information to be send to console.log (should make this a seperate func)
        const output = await merge_details(searchedData, uqTrips, uqRoutes, uqStopTimes);
        console.table(output);

        //save cache for next search
        let tripData = await fetchData(URL_TRIP);
        let vehicleData = await fetchData(URL_VEHICLE);

        await saveCache("trip", tripData);
        await saveCache("vehicle", vehicleData)

        /**
         * This function queries the live tripUpdate data to return the live trip information, to output the live ETA of the trip.
         * @param {string} input_trip_id - the trip_id of the trip to be searched for a live time of - iterated through matching uqTrips
         * @param {string} input_stop_id - the stop_id of the trip to be searched for a live time of - iterated through matching uqTrips
         * @returns {array} live_time - an array containing EITHER the estimated live arrival time, OR 'No Live Data'
         */
        async function findStopTimeUpdate(input_trip_id, input_stop_id) { 
                    
            const entityData = readCache("trip");
            const entityDataTripUpdate = entityData.map(x => x.tripUpdate); //print to find trips available
            const entityDataTripFilter = entityDataTripUpdate.filter(x => x.trip.tripId === input_trip_id);
            const entityDataStopTimeUpdate = entityDataTripFilter.map(x=>x.stopTimeUpdate);
            try {
                const live_time = entityDataStopTimeUpdate.map(y => y.find(z => z.stopId === input_stop_id).arrival.time);
                if (!live_time.length) {
                    return ['No Live Data'];
                }
                return live_time;
            } catch(error) {
                return ['No Live Data'];
            }
        }

        /**
         * This function queries the live vehicle data to return the live trip position, to output the live position of the trip.
         * @param {string} input_trip_id - the trip_id of the trip to be searched for a live time of - iterated through matching uqTrips
         * @param {string} input_stop_id - the stop_id of the trip to be searched for a live time of - iterated through matching uqTrips
         * @returns {array} live_pos - an array containing EITHER the live lat/long coords, OR 'No Live Data'
         */
        async function findLivePos(input_trip_id, input_stop_id) { 
                    
            const entityData = readCache("vehicle");
            const entityDataVehicle = entityData.map(x => x.vehicle); //print to find trips available;
            const entityDataTripFilter = entityDataVehicle.filter(x => x.trip.tripId === input_trip_id);// && x.stopId === input_stop_id);
            try {
                const live_pos = entityDataTripFilter.map(y => [y.position.latitude, y.position.longitude]);
                if (!live_pos.length) {
                    return ['No Live Data'];
                }
                return live_pos;
            } catch(error) {
                return ['No Live Data'];
            }
        }

        /**
         * This function searches both the static CSV files and the cached JSON files to return the filtered and searched 
         * trip and route data for matching trips.
         * @param {string} routeInput - validated selected input route: one of items in VALID_ROUTES
         * @param {string} dateInput  - validated selected input date, in format YYYY-MM-dd
         * @param {string} timeInput  - validated selected input time, in format HH:mm
         * @returns {array} searchedData - The array containing all bus times that meet the search critera.
         */      
        function search_data(date_input, time_input, route_input) {
            //format the date and time value for the search - this input value is alraedy validated in higher functions.
            const time = time_input.split(":");
            selectedDate.setUTCHours(time[0].valueOf());
            selectedDate.setUTCMinutes(time[1].valueOf());

            //filter the uqStopTimes by trip arrivals in the next 10 minutes
            let selectedTrip = uqStopTimes.filter(x => {
                //format trip date/time 
                let xtime = x.arrival_time.split(":");
                let xdate = new Date(date_input);

                //create comparison date
                xdate.setUTCHours(xtime[0]);
                xdate.setUTCMinutes(xtime[1]);
            
                //find difference in date in ms
                let dif = parseInt(xdate.getTime()) - parseInt(selectedDate.getTime());
                return  dif <= (10*60000) && dif >= 0;//magic number!
            })

            if (route_input !== 'Show All Routes') {
                //uq trips in next 10 mins that are ONLY chosen route number
                // route_input -> routes.route_short_name -> routes.route_id -> trips.route_id -> trips.trip_id -> stop_times.trip_id
                // use ARRIVAL time NOT starttime
                selectedTrip = selectedTrip.filter(x => {
                    let matchedBusRoutes = uqRoutes.filter(y => y.route_short_name === route_input);
                    let matchedBusRouteIds = matchedBusRoutes.map(z => z.route_id);
                    let matchedBusTrips = uqTrips.filter(a => matchedBusRouteIds.includes(a.route_id));
                    let matchedBusTripIds = matchedBusTrips.map(b => b.trip_id);
                    return matchedBusTripIds.includes(x.trip_id);
                }) 
            }

            //if showing all routes, apply the above filter to each busroute listed in VALID_ROUTES
            return selectedTrip.filter(x => {
                let matchedBusRoutes = uqRoutes.filter(y => VALID_ROUTES.includes(y.route_short_name));
                let matchedBusRouteIds = matchedBusRoutes.map(z => z.route_id);
                let matchedBusTrips = uqTrips.filter(a => matchedBusRouteIds.includes(a.route_id));
                let matchedBusTripIds = matchedBusTrips.map(b => b.trip_id);
                return matchedBusTripIds.includes(x.trip_id);
            })

            };
        
        /**
         * 
         * @param {Array} selected_trip - the array containg uq trips that match the search critera
         * @param {*} uq_trips shouldnt need - defined in above scope. 
         * @param {*} uq_routes shouldnt need - defined in above scope. 
         * @param {*} uq_stops shouldnt need - defined in above scope. 
         * @returns {Array} - the array of output data that is formatted for presentation in console.table
         */
        async function merge_details(selected_trip, uq_trips, uq_routes, uq_stops) {
            const searchedDataTripIds = selected_trip.map(search => search.trip_id);

            const searchedDataUqTrips = uq_trips.filter(trip => searchedDataTripIds.includes(trip.trip_id));
            const searchedDataUqStops = uq_stops.filter(trip => searchedDataTripIds.includes(trip.trip_id));

            const searchedDataUqRouteIds = searchedDataUqTrips.map(search => search.route_id);
            const searchedDataUqRoutes = uq_routes.filter(route => searchedDataUqRouteIds.includes(route.route_id));
                        
            const out =  await Promise.all(selected_trip.map(async trip => {
                const selectedTripData = searchedDataUqTrips.find(search => search.trip_id === trip.trip_id);
                const selectedRouteData = searchedDataUqRoutes.find(search => search.route_id === selectedTripData.route_id);
                const selectedStopData = searchedDataUqStops.find(search => search.trip_id === trip.trip_id);
                let liveTime = await findStopTimeUpdate(trip.trip_id, selectedStopData.stop_id);

                if (!liveTime) {
                    liveTime = ['No Live Data'];
                }
                let livePos = await (findLivePos(trip.trip_id, selectedStopData.stop_id));
                if (!livePos) {
                    livePos = ['No Live Data'];
                }
                return {
                    "Route Short Name": selectedRouteData.route_short_name,
                    "Route Long Name": selectedRouteData.route_long_name,
                    "Service ID": selectedTripData.service_id,
                    "Heading Sign": selectedTripData.trip_headsign,
                    "Scheduled Arrival Time": trip.arrival_time,
                    "Live Arrival Time" : liveTime[0],
                    "Live Position": livePos[0]
                    //stop_id: selectedStopData.stop_id,    //debugging
                    //trip_id: trip.trip_id                 //debugging
                }
            })); 

            return out;
    }
}

    /**
     * This function controls the main user input loop for entering parameters to search the data for. 
     * The user is asked to enter:
     *  Date - in format YYYY-MM-dd
     *  Time - in format HH:mm

     * @returns = load_data function to initiate the search query. 
     */
    async function search() {

        /**
         * Date prompt
         * User is prompted for an input a date to search, in the format YYYY-MM-dd
         * This input is validated in two methods: 
         *      the length of the string must not be longer than 10
         *      the 5th and 8th character must be a hyphen ('-').
         * @returns:
         *      {self} (if) an invalid input has been entered, 
         *      (else) enteredDate {string} - the validated time string.
         * */
        /*Date*/
        let date = () => {
            const enteredDate = prompt(PROMPT_DATE);
            /* Error Checking*/
            if (enteredDate[4] !== '-' || enteredDate[7] !== '-' ||enteredDate.length > 10){
                print(ERR_DATE);
                return date()
            } else {
                return enteredDate;
            }
        } 

        /**
         * Time prompt
         * User is prompted for an input a bus time in the format HH:mm
         * This input is validated in two methods: 
         *      the length of the string must not be longer than 5
         *      the third character must be a colon (':').
         * @returns:
         *      {self} (if) an invalid input has been entered, 
         *      (else) enteredTime {string} - the validated time string. 
         * */
        let time = () => {
            const enteredTime = prompt(PROMPT_TIME);
            /* Error Checking*/
            if (enteredTime[2] !== ':' || enteredTime.length > 5){
                print(ERR_TIME);
                return time()
            } else {
                return enteredTime
            }
        } 

        /**
         * Route prompt
         * User is prompted for an input of one of the selection in VALID_ROUTE_INPUTS, to a corresponding VALID_ROUTE
         * Note: while the user is requested to input a numerical value 1 - 9, upon recieving a valid input, 
         * this is immediately translated to its corresponding bus route short name string for search purposes.
         * @returns:
         *      {self} (if) an invalid input has been entered, 
         *      (else) route {string} - the validated and converted bus route short string to be searched. 
         * */
        let route = () => {
            const enteredRoute = prompt(PROMPT_ROUTE);
            /* Error Checking*/
            if (!VALID_ROUTE_INPUTS.includes(enteredRoute)){
                print(ERR_ROUTE)
                return route()
            } else {
                return VALID_ROUTES[enteredRoute-1];
            }
        } 

        const userDate = date();
        const userTime = time();
        const userRoute = route();
        return loadData(userRoute,userDate,userTime);
    }

    /* ---------- Main Loop ---------- */

    //fetch json data - this should be in load_data, but sometimes doesnt work


    await start();
    await search();
    end();
    
}

main();

/*
LIVE TIME AS HH:MM:SS
try to fix gradescope tests -> fix cached data save/read
*/