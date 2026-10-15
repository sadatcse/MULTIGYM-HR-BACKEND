import { Controller, Get, Header, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AttendanceService, IncomingPunch } from './attendance.service';

// ZKTeco "ADMS" / iclock push protocol. Point the device's Cloud Server
// setting at this backend (Comm. -> Cloud Server Setting -> server address
// + port, HTTPS off for older firmware) and it will:
//   GET  /iclock/cdata?SN=...&options=all   handshake, we reply with options
//   POST /iclock/cdata?SN=...&table=ATTLOG  tab-separated attendance lines
//   GET  /iclock/getrequest?SN=...          polls for commands (none)
//   POST /iclock/devicecmd?SN=...           command results
// These routes are mounted outside the /api prefix (see main.ts) because
// device firmware hardcodes the /iclock path. Devices self-register as
// "pending" and their logs are refused (kept on the device, re-sent later)
// until an admin activates the device and assigns its branch.
@Controller('iclock')
export class IclockController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('cdata')
  @Header('Content-Type', 'text/plain')
  async handshake(@Query('SN') sn: string, @Req() req: Request) {
    const device = await this.attendance.touchDevice(sn, req.ip);
    if (!device) return 'ERROR: missing SN';
    return [
      `GET OPTION FROM: ${device.serialNumber}`,
      `ATTLOGStamp=${device.lastStamp || 'None'}`,
      'OPERLOGStamp=9999',
      'ATTPHOTOStamp=None',
      'ErrorDelay=60',
      'Delay=30',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      'TransFlag=TransData AttLog',
      'TimeZone=6',
      'Realtime=1',
      'Encrypt=None',
    ].join('\n');
  }

  @Post('cdata')
  @HttpCode(200)
  async upload(@Query('SN') sn: string, @Query('table') table: string, @Query('Stamp') stamp: string, @Req() req: Request, @Res() res: Response) {
    res.type('text/plain');
    const device = await this.attendance.touchDevice(sn, req.ip);
    if (!device) return res.send('ERROR: missing SN');
    if (String(table).toUpperCase() !== 'ATTLOG') return res.send('OK');
    if (device.status !== 'active') return res.status(403).send('ERROR: device not approved');

    const body = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const punches: IncomingPunch[] = [];
    for (const line of body.split(/\r?\n/)) {
      const parts = line.split('\t');
      if (parts.length < 2 || !parts[0].trim()) continue;
      punches.push({
        deviceUserId: parts[0].trim(),
        time: parts[1].trim(),
        punchState: parts[2]?.trim() || '',
        verifyMode: parts[3]?.trim() || '',
        deviceSerial: device.serialNumber,
        branch: device.branch,
        source: 'device',
      });
    }
    const result = await this.attendance.ingestPunches(punches);
    device.lastPunchAt = new Date();
    device.totalPunches = (device.totalPunches || 0) + result.stored;
    if (stamp) device.lastStamp = stamp;
    await device.save();
    return res.send(`OK: ${punches.length}`);
  }

  @Get('getrequest')
  @Header('Content-Type', 'text/plain')
  async getRequest(@Query('SN') sn: string, @Req() req: Request) {
    await this.attendance.touchDevice(sn, req.ip);
    return 'OK';
  }

  @Post('devicecmd')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  deviceCmd() {
    return 'OK';
  }
}
