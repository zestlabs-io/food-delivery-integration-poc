import { FoodDeliveryODOOAPI } from '../src/FoodDeliveryODOOAPI';
import { FoodDeliveryZESTAPI, Delivery, Customer, Order, OrderItem, GeoCoordinates } from '../src/FoodDeliveryZESTAPI';
import { LocationIQAPI, LocationIQCoordinates } from '../src/LocationIQAPI';

import { DistrConfigServiceApiHMAC, PoolDataServiceApiHMAC, AuthServiceApiHMAC } from '@zestlabs-io/zest-js-sdk';

const odooUrl = 'https://furisto.zlak.one';
const zestUrl = 'https://dev.zestlabs.cloud';
var odooApi: FoodDeliveryODOOAPI
var zestApi: FoodDeliveryZESTAPI
var authAPI: AuthServiceApiHMAC
var distrAPI: DistrConfigServiceApiHMAC
var locAPI: LocationIQAPI

beforeAll(async (done) => {
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

  await odooApi.doLogin();
  done();
});

test('Get and Post Full data for day', async (done) => {
  const scheduleDate = '2020-09-14';
  const transportsResult = await odooApi.getTransports(scheduleDate);
  var orders: Order[] = new Array<Order>();

  for (let t of transportsResult.result.data) {
    console.log('--> Processing transport: ', JSON.stringify(t))
    const delDetailsResp = await odooApi.getDeliveryDetails(t.delivery_id.id)
    // console.log(' --> Processing tnansport', JSON.stringify(t, null, 2), 'with delivery', JSON.stringify(delDetailsResp.result.data, null, 2));
    // Check if the customer exists
    const deliveries = delDetailsResp.result.data;
    const delDetails = deliveries[0];
    const delLineIDs = delDetails.move_line_ids_without_package.replace('stock.move.line(', '').replace(')', '').split(', ')
    // console.log('========= > delivery lines ', delDetails.move_line_ids_without_package, delDetails.move_lines, delLineIDs)
    var orderItems = new Array<OrderItem>();
    try {
      const delLines = await odooApi.getDeliveryLines(delLineIDs);
      // console.log('Delivery lines', delLines.result.data)
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
    }

    try {
      if (delDetails.partner_id !== undefined) {
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
        const coordinates = await locAPI.getCoordinates(address);
        if (coordinates && coordinates.length >= 1) {
          geoLoc = { lat: parseFloat(coordinates[0].lat), long: parseFloat(coordinates[0].lon) } as GeoCoordinates
        }
      } catch (err) {
        console.log('Failed to fetch get coordinates', err)
      }
      const c = {
        _id: delDetails.partner_id.id.toString(),
        name: delDetails.partner_id.name,
        address: address,
        phone: typeof delDetails.partner_id.mobile === "string" ? delDetails.partner_id.mobile : "",
        loc: geoLoc
      } as Customer;
      try {
        const createResp = await zestApi.createCustomer([c])
        expect(createResp.status).toBe(200)
        console.log('Created customer', c);
      } catch (err) {
        console.error("Failed to store customer", c, err)
        fail(err);
      }
    }

    try {
      const delGet = await zestApi.getOrder(delDetails.id.toString());
    } catch (err) {
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
    }
  }
  try {
    console.log('creating orders', orders);
    const createResp = await zestApi.createOrder(orders)
    expect(createResp.status).toBe(200)
    console.log('Created orders', orders, createResp.body);
  } catch (err) {
    console.error("Failed to store order", orders, err)
    fail(err);
  }
  done();
});
