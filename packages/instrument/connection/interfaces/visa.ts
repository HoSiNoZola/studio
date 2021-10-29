import ffi from "ffi-napi";
import ref from "ref-napi";
import os from "os";
import { ipcMain } from "electron";

import {
    CommunicationInterface,
    CommunicationInterfaceHost
} from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// based on https://github.com/petertorelli/ni-visa

const constants = {
    VI_ERROR: 0x80000000,

    VI_SPEC_VERSION: 0x00500800,

    VI_ATTR_RSRC_CLASS: 0xbfff0001,
    VI_ATTR_RSRC_NAME: 0xbfff0002,
    VI_ATTR_RSRC_IMPL_VERSION: 0x3fff0003,
    VI_ATTR_RSRC_LOCK_STATE: 0x3fff0004,
    VI_ATTR_MAX_QUEUE_LENGTH: 0x3fff0005,
    VI_ATTR_USER_DATA_32: 0x3fff0007,
    VI_ATTR_FDC_CHNL: 0x3fff000d,
    VI_ATTR_FDC_MODE: 0x3fff000f,
    VI_ATTR_FDC_GEN_SIGNAL_EN: 0x3fff0011,
    VI_ATTR_FDC_USE_PAIR: 0x3fff0013,
    VI_ATTR_SEND_END_EN: 0x3fff0016,
    VI_ATTR_TERMCHAR: 0x3fff0018,
    VI_ATTR_TMO_VALUE: 0x3fff001a,
    VI_ATTR_GPIB_READDR_EN: 0x3fff001b,
    VI_ATTR_IO_PROT: 0x3fff001c,
    VI_ATTR_DMA_ALLOW_EN: 0x3fff001e,
    VI_ATTR_ASRL_BAUD: 0x3fff0021,
    VI_ATTR_ASRL_DATA_BITS: 0x3fff0022,
    VI_ATTR_ASRL_PARITY: 0x3fff0023,
    VI_ATTR_ASRL_STOP_BITS: 0x3fff0024,
    VI_ATTR_ASRL_FLOW_CNTRL: 0x3fff0025,
    VI_ATTR_RD_BUF_OPER_MODE: 0x3fff002a,
    VI_ATTR_RD_BUF_SIZE: 0x3fff002b,
    VI_ATTR_WR_BUF_OPER_MODE: 0x3fff002d,
    VI_ATTR_WR_BUF_SIZE: 0x3fff002e,
    VI_ATTR_SUPPRESS_END_EN: 0x3fff0036,
    VI_ATTR_TERMCHAR_EN: 0x3fff0038,
    VI_ATTR_DEST_ACCESS_PRIV: 0x3fff0039,
    VI_ATTR_DEST_BYTE_ORDER: 0x3fff003a,
    VI_ATTR_SRC_ACCESS_PRIV: 0x3fff003c,
    VI_ATTR_SRC_BYTE_ORDER: 0x3fff003d,
    VI_ATTR_SRC_INCREMENT: 0x3fff0040,
    VI_ATTR_DEST_INCREMENT: 0x3fff0041,
    VI_ATTR_WIN_ACCESS_PRIV: 0x3fff0045,
    VI_ATTR_WIN_BYTE_ORDER: 0x3fff0047,
    VI_ATTR_GPIB_ATN_STATE: 0x3fff0057,
    VI_ATTR_GPIB_ADDR_STATE: 0x3fff005c,
    VI_ATTR_GPIB_CIC_STATE: 0x3fff005e,
    VI_ATTR_GPIB_NDAC_STATE: 0x3fff0062,
    VI_ATTR_GPIB_SRQ_STATE: 0x3fff0067,
    VI_ATTR_GPIB_SYS_CNTRL_STATE: 0x3fff0068,
    VI_ATTR_GPIB_HS488_CBL_LEN: 0x3fff0069,
    VI_ATTR_CMDR_LA: 0x3fff006b,
    VI_ATTR_VXI_DEV_CLASS: 0x3fff006c,
    VI_ATTR_MAINFRAME_LA: 0x3fff0070,
    VI_ATTR_MANF_NAME: 0xbfff0072,
    VI_ATTR_MODEL_NAME: 0xbfff0077,
    VI_ATTR_VXI_VME_INTR_STATUS: 0x3fff008b,
    VI_ATTR_VXI_TRIG_STATUS: 0x3fff008d,
    VI_ATTR_VXI_VME_SYSFAIL_STATE: 0x3fff0094,
    VI_ATTR_WIN_BASE_ADDR_32: 0x3fff0098,
    VI_ATTR_WIN_SIZE_32: 0x3fff009a,
    VI_ATTR_ASRL_AVAIL_NUM: 0x3fff00ac,
    VI_ATTR_MEM_BASE_32: 0x3fff00ad,
    VI_ATTR_ASRL_CTS_STATE: 0x3fff00ae,
    VI_ATTR_ASRL_DCD_STATE: 0x3fff00af,
    VI_ATTR_ASRL_DSR_STATE: 0x3fff00b1,
    VI_ATTR_ASRL_DTR_STATE: 0x3fff00b2,
    VI_ATTR_ASRL_END_IN: 0x3fff00b3,
    VI_ATTR_ASRL_END_OUT: 0x3fff00b4,
    VI_ATTR_ASRL_REPLACE_CHAR: 0x3fff00be,
    VI_ATTR_ASRL_RI_STATE: 0x3fff00bf,
    VI_ATTR_ASRL_RTS_STATE: 0x3fff00c0,
    VI_ATTR_ASRL_XON_CHAR: 0x3fff00c1,
    VI_ATTR_ASRL_XOFF_CHAR: 0x3fff00c2,
    VI_ATTR_WIN_ACCESS: 0x3fff00c3,
    VI_ATTR_RM_SESSION: 0x3fff00c4,
    VI_ATTR_VXI_LA: 0x3fff00d5,
    VI_ATTR_MANF_ID: 0x3fff00d9,
    VI_ATTR_MEM_SIZE_32: 0x3fff00dd,
    VI_ATTR_MEM_SPACE: 0x3fff00de,
    VI_ATTR_MODEL_CODE: 0x3fff00df,
    VI_ATTR_SLOT: 0x3fff00e8,
    VI_ATTR_INTF_INST_NAME: 0xbfff00e9,
    VI_ATTR_IMMEDIATE_SERV: 0x3fff0100,
    VI_ATTR_INTF_PARENT_NUM: 0x3fff0101,
    VI_ATTR_RSRC_SPEC_VERSION: 0x3fff0170,
    VI_ATTR_INTF_TYPE: 0x3fff0171,
    VI_ATTR_GPIB_PRIMARY_ADDR: 0x3fff0172,
    VI_ATTR_GPIB_SECONDARY_ADDR: 0x3fff0173,
    VI_ATTR_RSRC_MANF_NAME: 0xbfff0174,
    VI_ATTR_RSRC_MANF_ID: 0x3fff0175,
    VI_ATTR_INTF_NUM: 0x3fff0176,
    VI_ATTR_TRIG_ID: 0x3fff0177,
    VI_ATTR_GPIB_REN_STATE: 0x3fff0181,
    VI_ATTR_GPIB_UNADDR_EN: 0x3fff0184,
    VI_ATTR_DEV_STATUS_BYTE: 0x3fff0189,
    VI_ATTR_FILE_APPEND_EN: 0x3fff0192,
    VI_ATTR_VXI_TRIG_SUPPORT: 0x3fff0194,
    VI_ATTR_TCPIP_ADDR: 0xbfff0195,
    VI_ATTR_TCPIP_HOSTNAME: 0xbfff0196,
    VI_ATTR_TCPIP_PORT: 0x3fff0197,
    VI_ATTR_TCPIP_DEVICE_NAME: 0xbfff0199,
    VI_ATTR_TCPIP_NODELAY: 0x3fff019a,
    VI_ATTR_TCPIP_KEEPALIVE: 0x3fff019b,
    VI_ATTR_4882_COMPLIANT: 0x3fff019f,
    VI_ATTR_USB_SERIAL_NUM: 0xbfff01a0,
    VI_ATTR_USB_INTFC_NUM: 0x3fff01a1,
    VI_ATTR_USB_PROTOCOL: 0x3fff01a7,
    VI_ATTR_USB_MAX_INTR_SIZE: 0x3fff01af,
    VI_ATTR_PXI_DEV_NUM: 0x3fff0201,
    VI_ATTR_PXI_FUNC_NUM: 0x3fff0202,
    VI_ATTR_PXI_BUS_NUM: 0x3fff0205,
    VI_ATTR_PXI_CHASSIS: 0x3fff0206,
    VI_ATTR_PXI_SLOTPATH: 0xbfff0207,
    VI_ATTR_PXI_SLOT_LBUS_LEFT: 0x3fff0208,
    VI_ATTR_PXI_SLOT_LBUS_RIGHT: 0x3fff0209,
    VI_ATTR_PXI_TRIG_BUS: 0x3fff020a,
    VI_ATTR_PXI_STAR_TRIG_BUS: 0x3fff020b,
    VI_ATTR_PXI_STAR_TRIG_LINE: 0x3fff020c,
    VI_ATTR_PXI_SRC_TRIG_BUS: 0x3fff020d,
    VI_ATTR_PXI_DEST_TRIG_BUS: 0x3fff020e,
    VI_ATTR_PXI_MEM_TYPE_BAR0: 0x3fff0211,
    VI_ATTR_PXI_MEM_TYPE_BAR1: 0x3fff0212,
    VI_ATTR_PXI_MEM_TYPE_BAR2: 0x3fff0213,
    VI_ATTR_PXI_MEM_TYPE_BAR3: 0x3fff0214,
    VI_ATTR_PXI_MEM_TYPE_BAR4: 0x3fff0215,
    VI_ATTR_PXI_MEM_TYPE_BAR5: 0x3fff0216,
    VI_ATTR_PXI_MEM_BASE_BAR0_32: 0x3fff0221,
    VI_ATTR_PXI_MEM_BASE_BAR1_32: 0x3fff0222,
    VI_ATTR_PXI_MEM_BASE_BAR2_32: 0x3fff0223,
    VI_ATTR_PXI_MEM_BASE_BAR3_32: 0x3fff0224,
    VI_ATTR_PXI_MEM_BASE_BAR4_32: 0x3fff0225,
    VI_ATTR_PXI_MEM_BASE_BAR5_32: 0x3fff0226,
    VI_ATTR_PXI_MEM_BASE_BAR0_64: 0x3fff0228,
    VI_ATTR_PXI_MEM_BASE_BAR1_64: 0x3fff0229,
    VI_ATTR_PXI_MEM_BASE_BAR2_64: 0x3fff022a,
    VI_ATTR_PXI_MEM_BASE_BAR3_64: 0x3fff022b,
    VI_ATTR_PXI_MEM_BASE_BAR4_64: 0x3fff022c,
    VI_ATTR_PXI_MEM_BASE_BAR5_64: 0x3fff022d,
    VI_ATTR_PXI_MEM_SIZE_BAR0_32: 0x3fff0231,
    VI_ATTR_PXI_MEM_SIZE_BAR1_32: 0x3fff0232,
    VI_ATTR_PXI_MEM_SIZE_BAR2_32: 0x3fff0233,
    VI_ATTR_PXI_MEM_SIZE_BAR3_32: 0x3fff0234,
    VI_ATTR_PXI_MEM_SIZE_BAR4_32: 0x3fff0235,
    VI_ATTR_PXI_MEM_SIZE_BAR5_32: 0x3fff0236,
    VI_ATTR_PXI_MEM_SIZE_BAR0_64: 0x3fff0238,
    VI_ATTR_PXI_MEM_SIZE_BAR1_64: 0x3fff0239,
    VI_ATTR_PXI_MEM_SIZE_BAR2_64: 0x3fff023a,
    VI_ATTR_PXI_MEM_SIZE_BAR3_64: 0x3fff023b,
    VI_ATTR_PXI_MEM_SIZE_BAR4_64: 0x3fff023c,
    VI_ATTR_PXI_MEM_SIZE_BAR5_64: 0x3fff023d,
    VI_ATTR_PXI_IS_EXPRESS: 0x3fff0240,
    VI_ATTR_PXI_SLOT_LWIDTH: 0x3fff0241,
    VI_ATTR_PXI_MAX_LWIDTH: 0x3fff0242,
    VI_ATTR_PXI_ACTUAL_LWIDTH: 0x3fff0243,
    VI_ATTR_PXI_DSTAR_BUS: 0x3fff0244,
    VI_ATTR_PXI_DSTAR_SET: 0x3fff0245,
    VI_ATTR_PXI_ALLOW_WRITE_COMBINE: 0x3fff0246,
    VI_ATTR_TCPIP_HISLIP_OVERLAP_EN: 0x3fff0300,
    VI_ATTR_TCPIP_HISLIP_VERSION: 0x3fff0301,
    VI_ATTR_TCPIP_HISLIP_MAX_MESSAGE_KB: 0x3fff0302,
    VI_ATTR_TCPIP_IS_HISLIP: 0x3fff0303,

    VI_ATTR_JOB_ID: 0x3fff4006,
    VI_ATTR_EVENT_TYPE: 0x3fff4010,
    VI_ATTR_SIGP_STATUS_ID: 0x3fff4011,
    VI_ATTR_RECV_TRIG_ID: 0x3fff4012,
    VI_ATTR_INTR_STATUS_ID: 0x3fff4023,
    VI_ATTR_STATUS: 0x3fff4025,
    VI_ATTR_RET_COUNT_32: 0x3fff4026,
    VI_ATTR_BUFFER: 0x3fff4027,
    VI_ATTR_RECV_INTR_LEVEL: 0x3fff4041,
    VI_ATTR_OPER_NAME: 0xbfff4042,
    VI_ATTR_GPIB_RECV_CIC_STATE: 0x3fff4193,
    VI_ATTR_RECV_TCPIP_ADDR: 0xbfff4198,
    VI_ATTR_USB_RECV_INTR_SIZE: 0x3fff41b0,
    VI_ATTR_USB_RECV_INTR_DATA: 0xbfff41b1,
    VI_ATTR_PXI_RECV_INTR_SEQ: 0x3fff4240,
    VI_ATTR_PXI_RECV_INTR_DATA: 0x3fff4241,

    /*- Attributes (platform dependent size) ------------------------------------*/

    VI_ATTR_USER_DATA_64: 0x3fff000a,
    VI_ATTR_RET_COUNT_64: 0x3fff4028,
    VI_ATTR_USER_DATA: 0x3fff000a,
    VI_ATTR_RET_COUNT: 0x3fff4028,

    /*- Event Types -------------------------------------------------------------*/

    VI_EVENT_IO_COMPLETION: 0x3fff2009,
    VI_EVENT_TRIG: 0xbfff200a,
    VI_EVENT_SERVICE_REQ: 0x3fff200b,
    VI_EVENT_CLEAR: 0x3fff200d,
    VI_EVENT_EXCEPTION: 0xbfff200e,
    VI_EVENT_GPIB_CIC: 0x3fff2012,
    VI_EVENT_GPIB_TALK: 0x3fff2013,
    VI_EVENT_GPIB_LISTEN: 0x3fff2014,
    VI_EVENT_VXI_VME_SYSFAIL: 0x3fff201d,
    VI_EVENT_VXI_VME_SYSRESET: 0x3fff201e,
    VI_EVENT_VXI_SIGP: 0x3fff2020,
    VI_EVENT_VXI_VME_INTR: 0xbfff2021,
    VI_EVENT_PXI_INTR: 0x3fff2022,
    VI_EVENT_TCPIP_CONNECT: 0x3fff2036,
    VI_EVENT_USB_INTR: 0x3fff2037,

    VI_ALL_ENABLED_EVENTS: 0x3fff7fff,

    /*- Completion and Error Codes ----------------------------------------------*/

    VI_SUCCESS_EVENT_EN: 0x3fff0002,
    VI_SUCCESS_EVENT_DIS: 0x3fff0003,
    VI_SUCCESS_QUEUE_EMPTY: 0x3fff0004,
    VI_SUCCESS_TERM_CHAR: 0x3fff0005,
    VI_SUCCESS_MAX_CNT: 0x3fff0006,
    VI_SUCCESS_DEV_NPRESENT: 0x3fff007d,
    VI_SUCCESS_TRIG_MAPPED: 0x3fff007e,
    VI_SUCCESS_QUEUE_NEMPTY: 0x3fff0080,
    VI_SUCCESS_NCHAIN: 0x3fff0098,
    VI_SUCCESS_NESTED_SHARED: 0x3fff0099,
    VI_SUCCESS_NESTED_EXCLUSIVE: 0x3fff009a,
    VI_SUCCESS_SYNC: 0x3fff009b,

    VI_WARN_QUEUE_OVERFLOW: 0x3fff000c,
    VI_WARN_CONFIG_NLOADED: 0x3fff0077,
    VI_WARN_NULL_OBJECT: 0x3fff0082,
    VI_WARN_NSUP_ATTR_STATE: 0x3fff0084,
    VI_WARN_UNKNOWN_STATUS: 0x3fff0085,
    VI_WARN_NSUP_BUF: 0x3fff0088,
    VI_WARN_EXT_FUNC_NIMPL: 0x3fff00a9,

    VI_ERROR_SYSTEM_ERROR: 0x80000000 + 0x3fff0000,
    VI_ERROR_INV_OBJECT: 0x80000000 + 0x3fff000e,
    VI_ERROR_RSRC_LOCKED: 0x80000000 + 0x3fff000f,
    VI_ERROR_INV_EXPR: 0x80000000 + 0x3fff0010,
    VI_ERROR_RSRC_NFOUND: 0x80000000 + 0x3fff0011,
    VI_ERROR_INV_RSRC_NAME: 0x80000000 + 0x3fff0012,
    VI_ERROR_INV_ACC_MODE: 0x80000000 + 0x3fff0013,
    VI_ERROR_TMO: 0x80000000 + 0x3fff0015,
    VI_ERROR_CLOSING_FAILED: 0x80000000 + 0x3fff0016,
    VI_ERROR_INV_DEGREE: 0x80000000 + 0x3fff001b,
    VI_ERROR_INV_JOB_ID: 0x80000000 + 0x3fff001c,
    VI_ERROR_NSUP_ATTR: 0x80000000 + 0x3fff001d,
    VI_ERROR_NSUP_ATTR_STATE: 0x80000000 + 0x3fff001e,
    VI_ERROR_ATTR_READONLY: 0x80000000 + 0x3fff001f,
    VI_ERROR_INV_LOCK_TYPE: 0x80000000 + 0x3fff0020,
    VI_ERROR_INV_ACCESS_KEY: 0x80000000 + 0x3fff0021,
    VI_ERROR_INV_EVENT: 0x80000000 + 0x3fff0026,
    VI_ERROR_INV_MECH: 0x80000000 + 0x3fff0027,
    VI_ERROR_HNDLR_NINSTALLED: 0x80000000 + 0x3fff0028,
    VI_ERROR_INV_HNDLR_REF: 0x80000000 + 0x3fff0029,
    VI_ERROR_INV_CONTEXT: 0x80000000 + 0x3fff002a,
    VI_ERROR_QUEUE_OVERFLOW: 0x80000000 + 0x3fff002d,
    VI_ERROR_NENABLED: 0x80000000 + 0x3fff002f,
    VI_ERROR_ABORT: 0x80000000 + 0x3fff0030,
    VI_ERROR_RAW_WR_PROT_VIOL: 0x80000000 + 0x3fff0034,
    VI_ERROR_RAW_RD_PROT_VIOL: 0x80000000 + 0x3fff0035,
    VI_ERROR_OUTP_PROT_VIOL: 0x80000000 + 0x3fff0036,
    VI_ERROR_INP_PROT_VIOL: 0x80000000 + 0x3fff0037,
    VI_ERROR_BERR: 0x80000000 + 0x3fff0038,
    VI_ERROR_IN_PROGRESS: 0x80000000 + 0x3fff0039,
    VI_ERROR_INV_SETUP: 0x80000000 + 0x3fff003a,
    VI_ERROR_QUEUE_ERROR: 0x80000000 + 0x3fff003b,
    VI_ERROR_ALLOC: 0x80000000 + 0x3fff003c,
    VI_ERROR_INV_MASK: 0x80000000 + 0x3fff003d,
    VI_ERROR_IO: 0x80000000 + 0x3fff003e,
    VI_ERROR_INV_FMT: 0x80000000 + 0x3fff003f,
    VI_ERROR_NSUP_FMT: 0x80000000 + 0x3fff0041,
    VI_ERROR_LINE_IN_USE: 0x80000000 + 0x3fff0042,
    VI_ERROR_LINE_NRESERVED: 0x80000000 + 0x3fff0043,
    VI_ERROR_NSUP_MODE: 0x80000000 + 0x3fff0046,
    VI_ERROR_SRQ_NOCCURRED: 0x80000000 + 0x3fff004a,
    VI_ERROR_INV_SPACE: 0x80000000 + 0x3fff004e,
    VI_ERROR_INV_OFFSET: 0x80000000 + 0x3fff0051,
    VI_ERROR_INV_WIDTH: 0x80000000 + 0x3fff0052,
    VI_ERROR_NSUP_OFFSET: 0x80000000 + 0x3fff0054,
    VI_ERROR_NSUP_VAR_WIDTH: 0x80000000 + 0x3fff0055,
    VI_ERROR_WINDOW_NMAPPED: 0x80000000 + 0x3fff0057,
    VI_ERROR_RESP_PENDING: 0x80000000 + 0x3fff0059,
    VI_ERROR_NLISTENERS: 0x80000000 + 0x3fff005f,
    VI_ERROR_NCIC: 0x80000000 + 0x3fff0060,
    VI_ERROR_NSYS_CNTLR: 0x80000000 + 0x3fff0061,
    VI_ERROR_NSUP_OPER: 0x80000000 + 0x3fff0067,
    VI_ERROR_INTR_PENDING: 0x80000000 + 0x3fff0068,
    VI_ERROR_ASRL_PARITY: 0x80000000 + 0x3fff006a,
    VI_ERROR_ASRL_FRAMING: 0x80000000 + 0x3fff006b,
    VI_ERROR_ASRL_OVERRUN: 0x80000000 + 0x3fff006c,
    VI_ERROR_TRIG_NMAPPED: 0x80000000 + 0x3fff006e,
    VI_ERROR_NSUP_ALIGN_OFFSET: 0x80000000 + 0x3fff0070,
    VI_ERROR_USER_BUF: 0x80000000 + 0x3fff0071,
    VI_ERROR_RSRC_BUSY: 0x80000000 + 0x3fff0072,
    VI_ERROR_NSUP_WIDTH: 0x80000000 + 0x3fff0076,
    VI_ERROR_INV_PARAMETER: 0x80000000 + 0x3fff0078,
    VI_ERROR_INV_PROT: 0x80000000 + 0x3fff0079,
    VI_ERROR_INV_SIZE: 0x80000000 + 0x3fff007b,
    VI_ERROR_WINDOW_MAPPED: 0x80000000 + 0x3fff0080,
    VI_ERROR_NIMPL_OPER: 0x80000000 + 0x3fff0081,
    VI_ERROR_INV_LENGTH: 0x80000000 + 0x3fff0083,
    VI_ERROR_INV_MODE: 0x80000000 + 0x3fff0091,
    VI_ERROR_SESN_NLOCKED: 0x80000000 + 0x3fff009c,
    VI_ERROR_MEM_NSHARED: 0x80000000 + 0x3fff009d,
    VI_ERROR_LIBRARY_NFOUND: 0x80000000 + 0x3fff009e,
    VI_ERROR_NSUP_INTR: 0x80000000 + 0x3fff009f,
    VI_ERROR_INV_LINE: 0x80000000 + 0x3fff00a0,
    VI_ERROR_FILE_ACCESS: 0x80000000 + 0x3fff00a1,
    VI_ERROR_FILE_IO: 0x80000000 + 0x3fff00a2,
    VI_ERROR_NSUP_LINE: 0x80000000 + 0x3fff00a3,
    VI_ERROR_NSUP_MECH: 0x80000000 + 0x3fff00a4,
    VI_ERROR_INTF_NUM_NCONFIG: 0x80000000 + 0x3fff00a5,
    VI_ERROR_CONN_LOST: 0x80000000 + 0x3fff00a6,
    VI_ERROR_MACHINE_NAVAIL: 0x80000000 + 0x3fff00a7,
    VI_ERROR_NPERMISSION: 0x80000000 + 0x3fff00a8,

    /*- Other VISA Definitions --------------------------------------------------*/

    VI_VERSION_MAJOR: (0x00500800 & 0xfff00000) >> 20,
    VI_VERSION_MINOR: (0x00500800 & 0x000fff00) >> 8,
    VI_VERSION_SUBMINOR: 0x00500800 & 0x000000ff,

    VI_FIND_BUFLEN: 256,

    VI_INTF_GPIB: 1,
    VI_INTF_VXI: 2,
    VI_INTF_GPIB_VXI: 3,
    VI_INTF_ASRL: 4,
    VI_INTF_PXI: 5,
    VI_INTF_TCPIP: 6,
    VI_INTF_USB: 7,

    VI_PROT_NORMAL: 1,
    VI_PROT_FDC: 2,
    VI_PROT_HS488: 3,
    VI_PROT_4882_STRS: 4,
    VI_PROT_USBTMC_VENDOR: 5,

    VI_FDC_NORMAL: 1,
    VI_FDC_STREAM: 2,

    VI_LOCAL_SPACE: 0,
    VI_A16_SPACE: 1,
    VI_A24_SPACE: 2,
    VI_A32_SPACE: 3,
    VI_A64_SPACE: 4,
    VI_PXI_ALLOC_SPACE: 9,
    VI_PXI_CFG_SPACE: 10,
    VI_PXI_BAR0_SPACE: 11,
    VI_PXI_BAR1_SPACE: 12,
    VI_PXI_BAR2_SPACE: 13,
    VI_PXI_BAR3_SPACE: 14,
    VI_PXI_BAR4_SPACE: 15,
    VI_PXI_BAR5_SPACE: 16,
    VI_OPAQUE_SPACE: 0xffff,

    VI_UNKNOWN_LA: -1,
    VI_UNKNOWN_SLOT: -1,
    VI_UNKNOWN_LEVEL: -1,
    VI_UNKNOWN_CHASSIS: -1,

    VI_QUEUE: 1,
    VI_HNDLR: 2,
    VI_SUSPEND_HNDLR: 4,
    VI_ALL_MECH: 0xffff,

    VI_ANY_HNDLR: 0,

    VI_TRIG_ALL: -2,
    VI_TRIG_SW: -1,
    VI_TRIG_TTL0: 0,
    VI_TRIG_TTL1: 1,
    VI_TRIG_TTL2: 2,
    VI_TRIG_TTL3: 3,
    VI_TRIG_TTL4: 4,
    VI_TRIG_TTL5: 5,
    VI_TRIG_TTL6: 6,
    VI_TRIG_TTL7: 7,
    VI_TRIG_ECL0: 8,
    VI_TRIG_ECL1: 9,
    VI_TRIG_ECL2: 10,
    VI_TRIG_ECL3: 11,
    VI_TRIG_ECL4: 12,
    VI_TRIG_ECL5: 13,
    VI_TRIG_STAR_SLOT1: 14,
    VI_TRIG_STAR_SLOT2: 15,
    VI_TRIG_STAR_SLOT3: 16,
    VI_TRIG_STAR_SLOT4: 17,
    VI_TRIG_STAR_SLOT5: 18,
    VI_TRIG_STAR_SLOT6: 19,
    VI_TRIG_STAR_SLOT7: 20,
    VI_TRIG_STAR_SLOT8: 21,
    VI_TRIG_STAR_SLOT9: 22,
    VI_TRIG_STAR_SLOT10: 23,
    VI_TRIG_STAR_SLOT11: 24,
    VI_TRIG_STAR_SLOT12: 25,
    VI_TRIG_STAR_INSTR: 26,
    VI_TRIG_PANEL_IN: 27,
    VI_TRIG_PANEL_OUT: 28,
    VI_TRIG_STAR_VXI0: 29,
    VI_TRIG_STAR_VXI1: 30,
    VI_TRIG_STAR_VXI2: 31,
    VI_TRIG_TTL8: 32,
    VI_TRIG_TTL9: 33,
    VI_TRIG_TTL10: 34,
    VI_TRIG_TTL11: 35,

    VI_TRIG_PROT_DEFAULT: 0,
    VI_TRIG_PROT_ON: 1,
    VI_TRIG_PROT_OFF: 2,
    VI_TRIG_PROT_SYNC: 5,
    VI_TRIG_PROT_RESERVE: 6,
    VI_TRIG_PROT_UNRESERVE: 7,

    VI_READ_BUF: 1,
    VI_WRITE_BUF: 2,
    VI_READ_BUF_DISCARD: 4,
    VI_WRITE_BUF_DISCARD: 8,
    VI_IO_IN_BUF: 16,
    VI_IO_OUT_BUF: 32,
    VI_IO_IN_BUF_DISCARD: 64,
    VI_IO_OUT_BUF_DISCARD: 128,

    VI_FLUSH_ON_ACCESS: 1,
    VI_FLUSH_WHEN_FULL: 2,
    VI_FLUSH_DISABLE: 3,

    VI_NMAPPED: 1,
    VI_USE_OPERS: 2,
    VI_DEREF_ADDR: 3,
    VI_DEREF_ADDR_BYTE_SWAP: 4,

    VI_TMO_IMMEDIATE: 0,
    VI_TMO_INFINITE: 0xffffffff,

    VI_NO_LOCK: 0,
    VI_EXCLUSIVE_LOCK: 1,
    VI_SHARED_LOCK: 2,
    VI_LOAD_CONFIG: 4,

    VI_NO_SEC_ADDR: 0xffff,

    VI_ASRL_PAR_NONE: 0,
    VI_ASRL_PAR_ODD: 1,
    VI_ASRL_PAR_EVEN: 2,
    VI_ASRL_PAR_MARK: 3,
    VI_ASRL_PAR_SPACE: 4,

    VI_ASRL_STOP_ONE: 10,
    VI_ASRL_STOP_ONE5: 15,
    VI_ASRL_STOP_TWO: 20,

    VI_ASRL_FLOW_NONE: 0,
    VI_ASRL_FLOW_XON_XOFF: 1,
    VI_ASRL_FLOW_RTS_CTS: 2,
    VI_ASRL_FLOW_DTR_DSR: 4,

    VI_ASRL_END_NONE: 0,
    VI_ASRL_END_LAST_BIT: 1,
    VI_ASRL_END_TERMCHAR: 2,
    VI_ASRL_END_BREAK: 3,

    VI_STATE_ASSERTED: 1,
    VI_STATE_UNASSERTED: 0,
    VI_STATE_UNKNOWN: -1,

    VI_BIG_ENDIAN: 0,
    VI_LITTLE_ENDIAN: 1,

    VI_DATA_PRIV: 0,
    VI_DATA_NPRIV: 1,
    VI_PROG_PRIV: 2,
    VI_PROG_NPRIV: 3,
    VI_BLCK_PRIV: 4,
    VI_BLCK_NPRIV: 5,
    VI_D64_PRIV: 6,
    VI_D64_NPRIV: 7,
    VI_D64_2EVME: 8,
    VI_D64_SST160: 9,
    VI_D64_SST267: 10,
    VI_D64_SST320: 11,

    VI_WIDTH_8: 1,
    VI_WIDTH_16: 2,
    VI_WIDTH_32: 4,
    VI_WIDTH_64: 8,

    VI_GPIB_REN_DEASSERT: 0,
    VI_GPIB_REN_ASSERT: 1,
    VI_GPIB_REN_DEASSERT_GTL: 2,
    VI_GPIB_REN_ASSERT_ADDRESS: 3,
    VI_GPIB_REN_ASSERT_LLO: 4,
    VI_GPIB_REN_ASSERT_ADDRESS_LLO: 5,
    VI_GPIB_REN_ADDRESS_GTL: 6,

    VI_GPIB_ATN_DEASSERT: 0,
    VI_GPIB_ATN_ASSERT: 1,
    VI_GPIB_ATN_DEASSERT_HANDSHAKE: 2,
    VI_GPIB_ATN_ASSERT_IMMEDIATE: 3,

    VI_GPIB_HS488_DISABLED: 0,
    VI_GPIB_HS488_NIMPL: -1,

    VI_GPIB_UNADDRESSED: 0,
    VI_GPIB_TALKER: 1,
    VI_GPIB_LISTENER: 2,

    VI_VXI_CMD16: 0x0200,
    VI_VXI_CMD16_RESP16: 0x0202,
    VI_VXI_RESP16: 0x0002,
    VI_VXI_CMD32: 0x0400,
    VI_VXI_CMD32_RESP16: 0x0402,
    VI_VXI_CMD32_RESP32: 0x0404,
    VI_VXI_RESP32: 0x0004,

    VI_ASSERT_SIGNAL: -1,
    VI_ASSERT_USE_ASSIGNED: 0,
    VI_ASSERT_IRQ1: 1,
    VI_ASSERT_IRQ2: 2,
    VI_ASSERT_IRQ3: 3,
    VI_ASSERT_IRQ4: 4,
    VI_ASSERT_IRQ5: 5,
    VI_ASSERT_IRQ6: 6,
    VI_ASSERT_IRQ7: 7,

    VI_UTIL_ASSERT_SYSRESET: 1,
    VI_UTIL_ASSERT_SYSFAIL: 2,
    VI_UTIL_DEASSERT_SYSFAIL: 3,

    VI_VXI_CLASS_MEMORY: 0,
    VI_VXI_CLASS_EXTENDED: 1,
    VI_VXI_CLASS_MESSAGE: 2,
    VI_VXI_CLASS_REGISTER: 3,
    VI_VXI_CLASS_OTHER: 4,

    VI_PXI_ADDR_NONE: 0,
    VI_PXI_ADDR_MEM: 1,
    VI_PXI_ADDR_IO: 2,
    VI_PXI_ADDR_CFG: 3,

    VI_TRIG_UNKNOWN: -1,

    VI_PXI_LBUS_UNKNOWN: -1,
    VI_PXI_LBUS_NONE: 0,
    VI_PXI_LBUS_STAR_TRIG_BUS_0: 1000,
    VI_PXI_LBUS_STAR_TRIG_BUS_1: 1001,
    VI_PXI_LBUS_STAR_TRIG_BUS_2: 1002,
    VI_PXI_LBUS_STAR_TRIG_BUS_3: 1003,
    VI_PXI_LBUS_STAR_TRIG_BUS_4: 1004,
    VI_PXI_LBUS_STAR_TRIG_BUS_5: 1005,
    VI_PXI_LBUS_STAR_TRIG_BUS_6: 1006,
    VI_PXI_LBUS_STAR_TRIG_BUS_7: 1007,
    VI_PXI_LBUS_STAR_TRIG_BUS_8: 1008,
    VI_PXI_LBUS_STAR_TRIG_BUS_9: 1009,
    VI_PXI_STAR_TRIG_CONTROLLER: 1413,

    /*- National Instruments ----------------------------------------------------*/

    VI_ERROR_HW_NGENUINE: 0x80000000 + 0x3fff00aa,

    VI_INTF_RIO: 8,
    VI_INTF_FIREWIRE: 9,

    VI_ATTR_SYNC_MXI_ALLOW_EN: 0x3fff0161,

    /* This is for VXI SERVANT resources */

    VI_EVENT_VXI_DEV_CMD: 0xbfff200f,
    VI_ATTR_VXI_DEV_CMD_TYPE: 0x3fff4037,
    VI_ATTR_VXI_DEV_CMD_VALUE: 0x3fff4038,

    VI_VXI_DEV_CMD_TYPE_16: 16,
    VI_VXI_DEV_CMD_TYPE_32: 32,

    /* mode values include VI_VXI_RESP16, VI_VXI_RESP32, and the next 2 values */
    VI_VXI_RESP_NONE: 0,
    VI_VXI_RESP_PROT_ERROR: -1,

    /* This is for VXI TTL Trigger routing */

    VI_ATTR_VXI_TRIG_LINES_EN: 0x3fff4043,
    VI_ATTR_VXI_TRIG_DIR: 0x3fff4044,

    /* This allows extended Serial support on Win32 and on NI ENET Serial products */

    VI_ATTR_ASRL_DISCARD_NULL: 0x3fff00b0,
    VI_ATTR_ASRL_CONNECTED: 0x3fff01bb,
    VI_ATTR_ASRL_BREAK_STATE: 0x3fff01bc,
    VI_ATTR_ASRL_BREAK_LEN: 0x3fff01bd,
    VI_ATTR_ASRL_ALLOW_TRANSMIT: 0x3fff01be,
    VI_ATTR_ASRL_WIRE_MODE: 0x3fff01bf,

    VI_ASRL_WIRE_485_4: 0,
    VI_ASRL_WIRE_485_2_DTR_ECHO: 1,
    VI_ASRL_WIRE_485_2_DTR_CTRL: 2,
    VI_ASRL_WIRE_485_2_AUTO: 3,
    VI_ASRL_WIRE_232_DTE: 128,
    VI_ASRL_WIRE_232_DCE: 129,
    VI_ASRL_WIRE_232_AUTO: 130,

    VI_EVENT_ASRL_BREAK: 0x3fff2023,
    VI_EVENT_ASRL_CTS: 0x3fff2029,
    VI_EVENT_ASRL_DSR: 0x3fff202a,
    VI_EVENT_ASRL_DCD: 0x3fff202c,
    VI_EVENT_ASRL_RI: 0x3fff202e,
    VI_EVENT_ASRL_CHAR: 0x3fff2035,
    VI_EVENT_ASRL_TERMCHAR: 0x3fff2024,

    /* This is for fast viPeek/viPoke macros */

    VI_ATTR_PXI_SUB_MANF_ID: 0x3fff0203,
    VI_ATTR_PXI_SUB_MODEL_CODE: 0x3fff0204,

    VI_ATTR_PXI_USE_PREALLOC_POOL: 0x3fff020f,

    VI_ATTR_USB_BULK_OUT_PIPE: 0x3fff01a2,
    VI_ATTR_USB_BULK_IN_PIPE: 0x3fff01a3,
    VI_ATTR_USB_INTR_IN_PIPE: 0x3fff01a4,
    VI_ATTR_USB_CLASS: 0x3fff01a5,
    VI_ATTR_USB_SUBCLASS: 0x3fff01a6,
    VI_ATTR_USB_ALT_SETTING: 0x3fff01a8,
    VI_ATTR_USB_END_IN: 0x3fff01a9,
    VI_ATTR_USB_NUM_INTFCS: 0x3fff01aa,
    VI_ATTR_USB_NUM_PIPES: 0x3fff01ab,
    VI_ATTR_USB_BULK_OUT_STATUS: 0x3fff01ac,
    VI_ATTR_USB_BULK_IN_STATUS: 0x3fff01ad,
    VI_ATTR_USB_INTR_IN_STATUS: 0x3fff01ae,
    VI_ATTR_USB_CTRL_PIPE: 0x3fff01b0,

    VI_USB_PIPE_STATE_UNKNOWN: -1,
    VI_USB_PIPE_READY: 0,
    VI_USB_PIPE_STALLED: 1,

    VI_USB_END_NONE: 0,
    VI_USB_END_SHORT: 4,
    VI_USB_END_SHORT_OR_COUNT: 5,

    VI_ATTR_FIREWIRE_DEST_UPPER_OFFSET: 0x3fff01f0,
    VI_ATTR_FIREWIRE_SRC_UPPER_OFFSET: 0x3fff01f1,
    VI_ATTR_FIREWIRE_WIN_UPPER_OFFSET: 0x3fff01f2,
    VI_ATTR_FIREWIRE_VENDOR_ID: 0x3fff01f3,
    VI_ATTR_FIREWIRE_LOWER_CHIP_ID: 0x3fff01f4,
    VI_ATTR_FIREWIRE_UPPER_CHIP_ID: 0x3fff01f5,

    VI_FIREWIRE_DFLT_SPACE: 5
};

/**
 * Only works for SUCCESS, WARN, ERROR since they are unique. Also need to
 * convert signed since es6 doesn't interpret bit 31 as the sign bit natively,
 * e.g.:
 * 0xBFFF000E = 0x80000000 + 0x3FFF000E = VI_ERROR_INV_OBJECT
 *            = 3221159950
 *            = -1073807346
 * Returns text string or null
 */
function decodeStatus(code: any) {
    let key = null;
    Object.keys(constants).some((x: keyof typeof constants, y) => {
        if (x.match(/^VI_(SUCCESS|WARN|ERROR)/)) {
            if (code == constants[x]) {
                key = x;
                return true;
            }
        }
        return false;
    });
    return key;
}

export const vcon = {
    ...constants,
    decodeStatus
};

/**
 * Create types like the ones in "visatype.h" from National Instruments
 */
//const ViInt32 = ref.types.int32;
//const ViPInt32 = ref.refType(ViInt32);
const ViUInt32 = ref.types.uint32;
const ViPUInt32 = ref.refType(ViUInt32);
//const ViInt16 = ref.types.int16;
//const ViPInt16 = ref.refType(ViInt16);
const ViUInt16 = ref.types.uint16;
const ViPUInt16 = ref.refType(ViUInt16);
//const ViChar = ref.types.char;
//const ViPChar = ref.refType(ViChar);
const ViByte = ref.types.uchar;
const ViPByte = ref.refType(ViByte);
// Note, this needs to be ViUInt32, not ViInt32 other we get negative hex
const ViStatus = ViUInt32;
const ViObject = ViUInt32;
const ViSession = ViUInt32;
const ViPSession = ref.refType(ViSession);
//const ViString = ViPChar;
//const ViConstString = ViString;
//const ViRsrc = ViString;
//const ViConstRsrc = ViConstString;
const ViAccessMode = ViUInt32;
//const ViBuf = ViPByte;
const ViPBuf = ViPByte;
//const ViConstBuf = ViPByte;
const ViFindList = ViObject;
const ViPFindList = ref.refType(ViFindList);

// Choose the proper DLL name
let dllName;
// I didn't see Linux support on the NI website...
switch (os.platform()) {
    case "darwin":
        dllName = "visa.framework/visa";
        break;
    case "linux":
        dllName = "librsvisa";
        break;
    case "win32":
        dllName = os.arch() == "x64" ? "visa64.dll" : "visa32.dll";
        break;
}

console.log("VISA dll Name", dllName);

// 'string' is used to reduce code, the FFI module will create Buffers as needed
let libVisa: ReturnType<typeof ffi.Library> | undefined;

if (dllName) {
    try {
        libVisa = ffi.Library(dllName, {
            // Resource Manager Functions and Operations
            viOpenDefaultRM: [ViStatus, [ViPSession]],
            viFindRsrc: [
                ViStatus,
                [ViSession, "string", ViPFindList, ViPUInt32, "string"]
            ],
            viFindNext: [ViStatus, [ViFindList, "string"]],
            viParseRsrc: [
                ViStatus,
                [ViSession, "string", ViPUInt16, ViPUInt16]
            ],
            viParseRsrcEx: [
                ViStatus,
                [
                    ViSession,
                    "string",
                    ViPUInt16,
                    ViPUInt16,
                    "string",
                    "string",
                    "string"
                ]
            ],
            viOpen: [
                ViStatus,
                [ViSession, "string", ViAccessMode, ViUInt32, ViPSession]
            ],
            // Resource Template Operations
            viClose: [ViStatus, [ViObject]],
            // Basic I/O Operations
            viRead: [ViStatus, [ViSession, ViPBuf, ViUInt32, ViPUInt32]],
            viReadToFile: [
                ViStatus,
                [ViSession, "string", ViUInt32, ViPUInt32]
            ],
            viWrite: [ViStatus, [ViSession, "string", ViUInt32, ViPUInt32]]
        });
    } catch (err) {
        console.error("Failed to load VISA dll");
        libVisa = undefined;
    }
} else {
    libVisa = undefined;
}

// TODO: since error handling is undecided, every function calls this
function statusCheck(status: any) {
    if (status & vcon.VI_ERROR) {
        console.warn(
            "Warning: VISA Error: 0x" +
                (status >>> 0).toString(16).toUpperCase()
        );
        throw new Error();
    } else {
        if (status) {
            let str = vcon.decodeStatus(status);
            if (str != null) {
                //debug(`non-error status check: ${status.toString(16)} ${str}`);
            } else {
                //debug(`non-error status check: ${status.toString(16)}`);
            }
        }
    }
}

export function viOpenDefaultRM() {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pSesn = ref.alloc(ViSession);
    status = libVisa.viOpenDefaultRM(pSesn as any);
    statusCheck(status);
    return [status, pSesn.deref()];
}

function viFindRsrc(sesn: any, expr: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pFindList = ref.alloc(ViFindList);
    let pRetcnt = ref.alloc(ViUInt32);
    let instrDesc = Buffer.alloc(512);
    status = libVisa.viFindRsrc(
        sesn,
        expr,
        pFindList as any,
        pRetcnt as any,
        instrDesc as any
    );
    statusCheck(status);
    return [
        status,
        pFindList.deref(),
        pRetcnt.deref(),
        // Fake null-term string
        instrDesc.toString("ascii", 0, instrDesc.indexOf(0))
    ];
}

function viFindNext(findList: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let instrDesc = Buffer.alloc(512);
    status = libVisa.viFindNext(findList, instrDesc as any);
    statusCheck(status);
    return [
        status,
        // Fake null-term string
        instrDesc.toString("ascii", 0, instrDesc.indexOf(0))
    ];
}

export function viParseRsrc(sesn: any, rsrcName: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pIntfType = ref.alloc(ViUInt16);
    let pIntfNum = ref.alloc(ViUInt16);
    status = libVisa.viParseRsrc(
        sesn,
        rsrcName,
        pIntfType as any,
        pIntfNum as any
    );
    statusCheck(status);
    return [
        status,
        // This is a VI_INTF_* define
        pIntfType.deref(),
        // This is the board #
        pIntfNum.deref()
    ];
}

// TODO: Untested, I don't hardware that responds to this call
export function viParseRsrcEx(sesn: any, rsrcName: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pIntfType = ref.alloc(ViUInt16);
    let pIntfNum = ref.alloc(ViUInt16);
    let rsrcClass = Buffer.alloc(512);
    let expandedUnaliasedName = Buffer.alloc(512);
    let aliasIfExists = Buffer.alloc(512);
    status = libVisa.viParseRsrcEx(
        sesn,
        rsrcName,
        pIntfType as any,
        pIntfNum as any,
        rsrcClass as any,
        expandedUnaliasedName as any,
        aliasIfExists as any
    );
    statusCheck(status);
    return [
        status,
        // This is a VI_INTF_* define
        pIntfType.deref(),
        // This is the board #
        pIntfNum.deref(),
        rsrcClass.toString("ascii", 0, rsrcClass.indexOf(0)),
        expandedUnaliasedName.toString(
            "ascii",
            0,
            expandedUnaliasedName.indexOf(0)
        ),
        aliasIfExists.toString("ascii", 0, aliasIfExists.indexOf(0))
    ];
}

export function viOpen(
    sesn: any,
    rsrcName: any,
    accessMode: any = 0,
    openTimeout: any = 2000
) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pVi = ref.alloc(ViSession);
    status = libVisa.viOpen(
        sesn,
        rsrcName,
        accessMode,
        openTimeout,
        pVi as any
    );
    statusCheck(status);
    return [status, pVi.deref()];
}

export function viClose(vi: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    status = libVisa.viClose(vi);
    statusCheck(status);
    return status;
}

// TODO ... assuming viRead always returns a string, probably wrong
function viRead(vi: any, count: any = 512) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let buf = Buffer.alloc(count);
    let pRetCount = ref.alloc(ViUInt32);
    status = libVisa.viRead(vi, buf as any, buf.length, pRetCount as any);
    statusCheck(status);
    //debug(`read (${count}) -> ${pRetCount.deref()}`);
    return [
        status,
        ref.reinterpret(buf, pRetCount.deref(), 0).toString("binary")
    ];
}

// Returns the raw Buffer object rather than a decoded string
export function viReadRaw(vi: any, count: any = 512) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let buf = Buffer.alloc(count);
    let pRetCount = ref.alloc(ViUInt32);
    status = libVisa.viRead(vi, buf as any, buf.length, pRetCount as any);
    statusCheck(status);
    //debug(`readRaw: (${count}) -> ${pRetCount.deref()}`);
    return [status, buf.slice(0, pRetCount.deref())];
}

//	'viReadToFile': [ViStatus, [ViSession, 'string', ViUInt32, ViPUInt32]],
export function viReadToFile(vi: any, fileName: any, count: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pRetCount = ref.alloc(ViUInt32);
    status = libVisa.viReadToFile(vi, fileName, count, pRetCount as any);
    statusCheck(status);
    //debug(`readToFile (${count}) -> ${pRetCount.deref()}`);
    return [status];
}

function viWrite(vi: any, buf: any) {
    if (!libVisa) throw "VISA not supported";

    //debug("write:", buf);
    let status;
    let pRetCount = ref.alloc(ViUInt32);
    status = libVisa.viWrite(vi, buf, buf.length, pRetCount as any);
    statusCheck(status);
    if (pRetCount.deref() != buf.length) {
        throw new Error(
            "viWrite length fail" + `: ${pRetCount.deref()} vs ${buf.length}`
        );
    }
    return [status, pRetCount.deref()];
}

/**
 * These helper functions combine vi* functions to perform routine tasks.
 * Error handling is left to the vi* functions.
 */

/**
 * Returns a list of strings of found resources
 */
export function vhListResources(sesn: any, expr: any = "?*") {
    let descList = [];
    let [status, findList, retcnt, instrDesc] = viFindRsrc(sesn, expr);
    if (status == 0 && retcnt) {
        descList.push(instrDesc);
        for (let i = 1; i < retcnt; ++i) {
            [status, instrDesc] = viFindNext(findList);
            descList.push(instrDesc);
        }
    }
    return descList;
}

/**
 * TODO: How are compound queries handled (reponsed to)
 * Returns only the response, no status; status handled by error handler
 */
export function vhQuery(vi: any, query: any) {
    viWrite(vi, query);
    // TODO: return status as well?
    return viRead(vi)[1];
}

let status: number = 0;
let sesn: number = 0;

try {
    [status, sesn] = viOpenDefaultRM();
} catch (error) {
    console.error("viOpenDefaultRM", error);
}

ipcMain.on("get-visa-resources", function (event) {
    if (status == 0) {
        try {
            const resources = vhListResources(sesn);
            event.sender.send(
                "visa-resources",
                resources.map(resource => resource.toString())
            );
        } catch (err) {
            console.error("vhListResources", err);
        }
    }
});

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

export class VisaInterface implements CommunicationInterface {
    port: any;
    connectedCalled = false;
    data: string | undefined;

    vi: number | undefined;

    constructor(private host: CommunicationInterfaceHost) {
        // console.log("viOpenDefaultRM", status);
        // vhListResources(sesn).some(address => {
        //     console.log("address", address);
        //     const [status, vi] = viOpen(sesn, address);
        //     console.log("viOpen", status);
        //     const resp = vhQuery(vi, "*IDN?");
        //     console.log("Address " + address + " -> " + resp.toString().trim());
        //     if (typeof resp == "string") {
        //         if (resp.match(/SVA1/)) {
        //             console.log(`Using the first SVA1015 found at ${address}`);
        //             return true;
        //         }
        //     }
        //     viClose(vi);
        //     return false;
        // });
    }

    connect() {
        if (status != 0) {
            this.host.setError(
                ConnectionErrorCode.UNKNOWN,
                "VISA initialization failed."
            );
            this.host.disconnected();
            return;
        }

        try {
            const [viOpenStatus, vi] = viOpen(
                sesn,
                this.host.connectionParameters.visaParameters.resource
            );
            if (viOpenStatus != 0) {
                this.host.setError(
                    ConnectionErrorCode.UNKNOWN,
                    `Failed to open VISA resource, status = ${viOpenStatus}`
                );
                this.host.disconnected();
                return;
            }

            this.vi = vi;
            this.host.connected();
        } catch (err) {
            this.host.setError(
                ConnectionErrorCode.UNKNOWN,
                `Failed to open VISA resource: ${err.toString()}`
            );
            this.host.disconnected();
        }
    }

    isConnected() {
        return this.vi != undefined;
    }

    readLock = false;

    read = () => {
        if (this.readLock) {
            return;
        }

        if (this.vi != undefined) {
            try {
                this.readLock = true;
                const [status, buffer] = viRead(this.vi, 1024 * 1024);
                this.readLock = false;
                // TODO check status
                console.log("viRead return status", status);
                if (typeof buffer == "string") {
                    console.log(
                        `RECEIVED FROM VISA (showing first 10 of ${buffer.length} characters)`,
                        JSON.stringify(buffer.slice(0, 10))
                    );
                    this.host.onData(buffer);
                } else {
                    console.log(
                        "RECEIVED FROM VISA number",
                        JSON.stringify(buffer.toString())
                    );
                    this.host.onData(buffer.toString());
                }
                setTimeout(this.read, 0);
            } catch (err) {
                this.readLock = false;
                console.error("viRead", err.toString());
            }
        }
    };

    write(data: string) {
        if (this.vi != undefined) {
            console.log("SEND TO VISA", JSON.stringify(data));
            try {
                viWrite(this.vi, Buffer.from(data, "binary"));
                setTimeout(this.read, 0);
            } catch (err) {
                this.host.setError(
                    ConnectionErrorCode.UNKNOWN,
                    `Failed to write to VISA resource: ${err.toString()}`
                );
            }
        }
    }

    destroy() {
        if (this.vi != undefined) {
            try {
                viClose(this.vi);
            } catch (err) {
                console.error("viClose", err);
            }
            this.vi = undefined;
        }
        this.host.disconnected();
    }

    disconnect() {
        this.destroy();
    }
}