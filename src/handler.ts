import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
} from "aws-lambda";

import { FoodDeliveryODOOAPI } from './FoodDeliveryODOOAPI';
import { FoodDeliveryZESTAPI, Delivery, Customer, Order, OrderItem, GeoCoordinates } from './FoodDeliveryZESTAPI';
import { LocationIQAPI, LocationIQCoordinates } from './LocationIQAPI';

import { PoolDataServiceApiHMAC, DistrConfigServiceApiHMAC, AuthServiceApiHMAC } from '@zestlabs-io/zest-js-sdk';

interface FetchDeliveriesRespose {
  status: number
  error?: string[]
  deliveriesInserted?: string[]
  customersInserted?: string[]
}

interface FetchDeliveriesRequestParams {
  payload?: FDRPPayload
}

interface FDRPPayload {
  date?: string
}


export const fetchDeliveries = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {

  var resp = {
    status: 200
  } as FetchDeliveriesRespose;

  const odooUrl = 'https://furisto.zlak.one';
  const zestUrl = 'https://dev.zestlabs.cloud';
  var odooApi: FoodDeliveryODOOAPI
  var zestApi: FoodDeliveryZESTAPI
  var authAPI: AuthServiceApiHMAC
  var distrAPI: DistrConfigServiceApiHMAC
  var locAPI: LocationIQAPI

  const username = process.env.ODO_USERNAME || '';
  const password = process.env.ODO_PASSWORD || '';
  const zestKey = process.env.ZEST_KEY || '';
  const zestSecret = process.env.ZEST_SECRET || '';
  const locIQKey = process.env.LOCATIONIQ_KEY || '';
  zestApi = new FoodDeliveryZESTAPI(zestUrl, zestKey, zestSecret);
  odooApi = new FoodDeliveryODOOAPI(odooUrl, username, password);
  authAPI = new AuthServiceApiHMAC(zestUrl, zestKey, zestSecret);
  distrAPI = new DistrConfigServiceApiHMAC(zestUrl, zestKey, zestSecret);
  locAPI = new LocationIQAPI(locIQKey);

  try {
    await odooApi.doLogin();
  } catch (err) {
    resp.status = 500;
    resp.error = [JSON.stringify(err)]
    return {
      statusCode: 500,
      body: JSON.stringify(resp)
    }
  }
  const reqParams = event.body ? JSON.parse(event.body) as FetchDeliveriesRequestParams : event as FetchDeliveriesRequestParams;
  if (!reqParams.payload || !reqParams.payload.date) {
    resp.status = 400;
    resp.error = ["no date specified - " + JSON.stringify(event)]
    return {
      statusCode: 400,
      body: JSON.stringify(resp)
    }
  }

  const scheduleDate = reqParams.payload.date;
  const transportsResult = await odooApi.getTransports(scheduleDate);
  var orders: Order[] = new Array<Order>();

  for (let t of transportsResult.result.data) {
    console.log('--> Processing transport: ', JSON.stringify(t))
    const delDetailsResp = await odooApi.getDeliveryDetails(t.delivery_id.id)
    console.log(' --> Processing delivery details', JSON.stringify(delDetailsResp.result.data));
    // Check if the customer exists
    const deliveries = delDetailsResp.result.data;
    const delDetails = deliveries[0];
    const delLineIDs = delDetails.move_line_ids_without_package.replace('stock.move.line(', '').replace(')', '').split(', ')
    var orderItems = new Array<OrderItem>();
    try {
      const delLines = await odooApi.getDeliveryLines(delLineIDs);
      console.log(' --> Processing delivery items', delLines.result.data)
      for (let delLine of delLines.result.data) {
        const oi = {
          name: delLine.product_id.name,
          qty: delLine.qty_done,
          comments: '',
        } as OrderItem;
        orderItems.push(oi);
      }
    } catch (err) {
      console.error(err);
      if (!resp.error) {
        resp.error = []
      }
      resp.error.push(JSON.stringify(err))
    }

    try {
      if (delDetails.partner_id !== undefined) {
        console.log(' --> Fetching customer data', delDetails.partner_id.id)
        const custGet = await zestApi.getCustomer(delDetails.partner_id.id);
      } else {
        console.error("Got undefined partner", delDetails)
      }
    } catch (err) {
      // Not found - then insert it
      let address = delDetails.partner_id.contact_address
      if (delDetails.partner_id.contact_address.startsWith(delDetails.partner_id.name)) {
        address = delDetails.partner_id.contact_address.substring(delDetails.partner_id.name.length, delDetails.partner_id.contact_address.length).trim()
      }
      // Sanitize
      address = address.replace('\n\n', ',');
      address = address.replace('\n', ',');
      // Locate it
      var geoLoc: GeoCoordinates | null = null;
      try {
        console.log(' --> Fetching customer location for address', address)
        const coordinates = await locAPI.getCoordinates(address);
        if (coordinates && coordinates.length >= 1) {
          geoLoc = { lat: parseFloat(coordinates[0].lat), long: parseFloat(coordinates[0].lon) } as GeoCoordinates
        }
      } catch (err) {
        console.error('Failed to fetch get coordinates', err)
      }
      const c = {
        _id: delDetails.partner_id.id.toString(),
        name: delDetails.partner_id.name,
        address: address,
        phone: typeof delDetails.partner_id.mobile === "string" ? delDetails.partner_id.mobile : "",
        loc: geoLoc
      } as Customer;
      try {
        console.log(' --> Creating customer', JSON.stringify(c))
        const createResp = await zestApi.createCustomer([c])
        if (createResp.status !== 200) {
          resp.status = 500;
          resp.error = ["failed to create customer", JSON.stringify(createResp.body)]
          return {
            statusCode: 500,
            body: JSON.stringify(resp)
          }
        }
        console.log('Created customer', c);
        if (!resp.customersInserted)
          resp.customersInserted = [];
        resp.customersInserted.push(c._id)
      } catch (err) {
        console.error("Failed to store customer", c, err)
        resp.status = 500;
        resp.error = [JSON.stringify(err)]
        return {
          statusCode: 500,
          body: JSON.stringify(resp)
        }
      }
    }

    try {
      console.log(' --> Check order exists', delDetails.id.toString())
      const delGet = await zestApi.getOrder(delDetails.id.toString());
      console.log(' --> Check order exists - ', delGet.result.status)
    } catch (err) {
      console.log(' --> Check order exists... not found')
      // Not found - then insert it
      // Now store order
      const o = {
        _id: delDetails.id.toString(),
        comment: "",
        customerId: delDetails.partner_id.id.toString(),
        date: scheduleDate,
        routeId: t.transporter_id.id.toString(),
        orderItems: orderItems,
      } as Order;
      orders.push(o);
      if (!resp.deliveriesInserted)
        resp.deliveriesInserted = []
      resp.deliveriesInserted.push(o._id);
    }
  }
  try {
    console.log('Creating orders', orders);
    const createResp = await zestApi.createOrder(orders)
    if (createResp.status !== 200) {
      resp.status = 500;
      resp.error = [JSON.stringify(createResp.body)]
      return {
        statusCode: 500,
        body: JSON.stringify(resp)
      }
    }
    console.log('Created orders', orders, createResp.body);
  } catch (err) {
    console.error("Failed to store orders", orders, err)
    resp.status = 500;
    resp.error = [JSON.stringify(err)]
    return {
      statusCode: 500,
      body: JSON.stringify(resp)
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(resp)
  }
}